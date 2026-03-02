const express = require('express');
const router = express.Router();
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 1. KONFIGURASI MULTER (UPLOAD FOTO)
const storage = multer.diskStorage({
    destination: 'public/uploads/bukti/',
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// 2. QUERY TEMPLATE UNTUK TAHUNAN (PC & LAPTOP)
const getTahunanQuery = (type) => `
    SELECT 
        d.device_id, d.no, d.model, d.serial_number, d.hostname,
        d.jadwal_pmc AS bulan, h.tahun, h.riwayat_id, h.foto_bukti,
        u.fullname AS pemeriksa
    FROM devices d
    INNER JOIN histories h ON d.device_id = h.device_id
    LEFT JOIN users u ON h.checked_by = u.user_id
    WHERE d.device_type = '${type}' 
    AND d.pmc_category = 'Tahunan'
    AND h.status_pmc = 'Done'
    AND h.tahun = ? 
    AND d.jadwal_pmc = ?
    AND (d.model LIKE ? OR d.serial_number LIKE ?)
    ORDER BY h.tanggal_cek DESC
`;

// ==================================================
// ROUTE KHUSUS TAHUNAN (DENGAN TAB SWITCH)
// ==================================================

// A. Default Tahunan -> Redirect ke PC
router.get('/tahunan', (req, res) => {
    res.redirect('/laporan/pc');
});

// B. Halaman Laporan PC
router.get('/pc', (req, res) => {
    const { bulan = 'Januari', tahun = new Date().getFullYear().toString(), keyword = '' } = req.query;
    db.query(getTahunanQuery('PC'), [tahun, bulan, `%${keyword}%`, `%${keyword}%`], (err, results) => {
        if (err) return res.status(500).send(err.message);
        res.render('pages/laporan/pc', {
            title: 'Laporan PMC PC',
             layout: 'layouts/main',
            css: 'laporan.css',
            active: 'laporan', subActive: 'lap-tahunan', // Sidebar tetap di Tahunan
            laporan: results, bulanAktif: bulan, tahunAktif: tahun, keyword
        });
    });
});

// C. Halaman Laporan Laptop
router.get('/laptop', (req, res) => {
    const { bulan = 'Januari', tahun = new Date().getFullYear().toString(), keyword = '' } = req.query;
    db.query(getTahunanQuery('Laptop'), [tahun, bulan, `%${keyword}%`, `%${keyword}%`], (err, results) => {
        if (err) return res.status(500).send(err.message);
        res.render('pages/laporan/laptop', {
            title: 'Laporan PMC Laptop',
             layout: 'layouts/main',
            css: 'laporan.css',
            active: 'laporan', subActive: 'lap-tahunan', 
            laporan: results, bulanAktif: bulan, tahunAktif: tahun, keyword
        });
    });
});

// ==================================================
// ROUTE HARIAN & BULANAN (DINAMIS)
// ==================================================


// Rute Laporan Harian (Filter: Date Picker)
router.get('/harian', (req, res) => {
    // Default ke tanggal hari ini jika tidak ada input
    const { tanggal = new Date().toISOString().split('T')[0], keyword = '' } = req.query;

    const sql = `
        SELECT d.no, d.model, d.serial_number, d.lokasi,
        h.riwayat_id, h.foto_bukti, DATE_FORMAT(h.tanggal_cek, '%d/%m/%Y') as tgl_cek,
        u.fullname AS pemeriksa
        FROM histories h
        JOIN devices d ON h.device_id = d.device_id
        LEFT JOIN users u ON h.checked_by = u.user_id
        WHERE h.pmc_type = 'Harian' 
        AND h.status_pmc = 'Done'
        AND DATE(h.tanggal_cek) = ? 
        AND (d.model LIKE ? OR d.serial_number LIKE ?)
        ORDER BY h.tanggal_cek DESC
    `;

    db.query(sql, [tanggal, `%${keyword}%`, `%${keyword}%`], (err, results) => {
        if (err) return res.status(500).send(err.message);
        res.render('pages/laporan/harian', {
            title: 'Laporan PMC Harian',
            layout: 'layouts/main',
            css: 'laporan.css',
            active: 'laporan', subActive: 'lap-harian',
            laporan: results, tanggalAktif: tanggal, keyword
        });
    });
});

// Rute Laporan Bulanan (Filter: Tahun Saja)
router.get('/bulanan', (req, res) => {
    const { tahun = new Date().getFullYear().toString(), keyword = '' } = req.query;

    const sql = `
        SELECT d.no, d.model, d.serial_number, d.lokasi,
               h.riwayat_id, h.foto_bukti, h.tahun,
               u.fullname AS pemeriksa
        FROM histories h
        JOIN devices d ON h.device_id = d.device_id
        LEFT JOIN users u ON h.checked_by = u.user_id
        WHERE h.pmc_type = 'Bulanan' 
        AND h.status_pmc = 'Done'
        AND h.tahun = ? 
        AND (d.model LIKE ? OR d.serial_number LIKE ?)
        ORDER BY h.tanggal_cek DESC
    `;

    db.query(sql, [tahun, `%${keyword}%`, `%${keyword}%`], (err, results) => {
        if (err) return res.status(500).send(err.message);
        res.render('pages/laporan/bulanan', {
            title: 'Laporan PMC Bulanan',
            layout: 'layouts/main',
            css: 'laporan.css',
            active: 'laporan', subActive: 'lap-bulanan',
            laporan: results, tahunAktif: tahun, keyword
        });
    });
});


// ==================================================
// ACTION: UPLOAD & PREVIEW (GLOBAL)
// ==================================================

// Upload Foto Bukti
router.post('/upload-bukti/:riwayat_id', upload.single('foto'), (req, res) => {
    const { riwayat_id } = req.params;
    const newFoto = req.file ? req.file.filename : null;
    const backURL = req.header('Referer') || '/laporan/tahunan';

    if (!newFoto) return res.redirect(backURL);

    // 2. CARI NAMA FOTO LAMA DI DATABASE TERLEBIH DAHULU
    db.query("SELECT foto_bukti FROM histories WHERE riwayat_id = ?", [riwayat_id], (err, results) => {
        if (err) return res.status(500).send("DB Error");

        const oldFoto = results[0]?.foto_bukti;

        // 3. JIKA ADA FOTO LAMA, HAPUS DARI DISK INTERNAL
        if (oldFoto) {
            const oldPath = path.join(__dirname, '../public/uploads/bukti/', oldFoto);
            
            // Cek apakah file benar-benar ada sebelum dihapus
            if (fs.existsSync(oldPath)) {
                fs.unlink(oldPath, (errUnlink) => {
                    if (errUnlink) console.error("Gagal hapus file lama:", errUnlink);
                    else console.log("File lama berhasil dihapus dari server");
                });
            }
        }

        // 4. UPDATE DATABASE DENGAN NAMA FOTO YANG BARU
        db.query("UPDATE histories SET foto_bukti = ? WHERE riwayat_id = ?", [newFoto, riwayat_id], (errUpdate) => {
            if (errUpdate) return res.status(500).send("Gagal update DB");
            res.redirect(backURL);
        });
    });
});

// Preview PDF Utama
router.get('/preview/:id', (req, res) => {
    const sql = `
        SELECT d.*, h.*, u.fullname, u.ttd 
        FROM devices d
        JOIN histories h ON d.device_id = h.device_id
        LEFT JOIN users u ON h.checked_by = u.user_id
        WHERE h.riwayat_id = ?
    `;
    db.query(sql, [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(404).send("Data tidak ditemukan");
        const data = results[0];
 let template = '';

        // LOGIKA PEMILIHAN TEMPLATE BERDASARKAN TIPE PMC
        if (data.pmc_type === 'Harian') {
            template = 'previewHarian'; // Lu sudah punya file ini
        } else if (data.pmc_type === 'Bulanan') {
            template = 'previewBulanan'; // Kita buat file ini di bawah
        } else {
            // Default untuk Tahunan/Sewa tetap pakai pembeda PC/Laptop
            template = data.device_type === 'Laptop' ? 'previewLaptop' : 'previewPC';
        }

        res.render(`pages/laporan/${template}`, { layout: false, data: data });
    });
});

// FIX REDIRECT LOOP: Arahkan rute lama ke rute preview yang baru
router.get('/previewlaptop/:id', (req, res) => {
    res.redirect(`/laporan/preview/${req.params.id}`); // ARAHKAN KE /preview/ BUKAN KE DIRINYA SENDIRI
});

router.get('/previewpc/:id', (req, res) => {
    res.redirect(`/laporan/preview/${req.params.id}`); // ARAHKAN KE /preview/
});

module.exports = router;
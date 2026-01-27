const express = require('express');
const router = express.Router();
const db = require('../config/database');

// QUERY TEMPLATE (Agar tidak menulis berulang)
const getLaporanQuery = (type) => `
    SELECT 
        d.device_id, d.no, d.model, d.serial_number, 
        d.jadwal_pmc AS bulan, h.tahun, 
        u.fullname AS pemeriksa -- Ambil nama dari tabel users
    FROM devices d
    INNER JOIN histories h ON d.device_id = h.device_id
    LEFT JOIN users u ON h.checked_by = u.user_id -- JOIN berdasarkan ID
    WHERE d.device_type = '${type}' 
    AND h.status_pmc = 'Done'
    AND h.tahun = ? 
    AND d.jadwal_pmc = ?
    AND (d.model LIKE ? OR d.serial_number LIKE ?)
    ORDER BY h.tanggal_cek DESC
`;

// 1. LAPORAN LAPTOP
router.get('/laptop', (req, res) => {
    const { bulan = 'Januari', tahun = new Date().getFullYear().toString(), keyword = '' } = req.query;
    db.query(getLaporanQuery('Laptop'), [tahun, bulan, `%${keyword}%`, `%${keyword}%`], (err, results) => {
        if (err) return res.status(500).send(err.message);
        res.render('pages/laporan/laptop', {
            title: 'Laporan PMC Laptop',
            active: 'laporan', subActive: 'laptop', layout: 'layouts/main', css: 'laporan.css',
            laporan: results, bulanAktif: bulan, tahunAktif: tahun, keyword
        });
    });
});

// 2. LAPORAN PC
router.get('/pc', (req, res) => {
    const { bulan = 'Januari', tahun = new Date().getFullYear().toString(), keyword = '' } = req.query;
    db.query(getLaporanQuery('PC'), [tahun, bulan, `%${keyword}%`, `%${keyword}%`], (err, results) => {
        if (err) return res.status(500).send(err.message);
        res.render('pages/laporan/pc', {
            title: 'Laporan PMC PC',
            active: 'laporan', subActive: 'pc', layout: 'layouts/main', css: 'laporan.css',
            laporan: results, bulanAktif: bulan, tahunAktif: tahun, keyword
        });
    });
});

// 3. PREVIEW LAPORAN (LAPTOP & PC)
const getPreview = (req, res, page) => {
    const sql = `
        SELECT d.*, h.*, u.fullname, u.unit AS unit_user, u.ttd
        FROM devices d
        JOIN histories h ON d.device_id = h.device_id
        LEFT JOIN users u ON h.checked_by = u.user_id -- JOIN berdasarkan ID
        WHERE d.device_id = ? AND h.tahun = YEAR(NOW())
        ORDER BY h.riwayat_id DESC LIMIT 1
    `;
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).send(err.message);
        res.render(`pages/laporan/${page}`, { layout: false, data: results[0] });
    });
};

router.get('/previewlaptop/:id', (req, res) => getPreview(req, res, 'previewLaptop'));
router.get('/previewpc/:id', (req, res) => getPreview(req, res, 'previewPC'));

module.exports = router;
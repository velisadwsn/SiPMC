const express = require("express"); 
const router = express.Router();    
const db = require("../config/database");

// ==================================================
// 1. LIST BULANAN + CARI
// ==================================================
router.get("/", (req, res) => {
    let keyword = req.query.keyword || "";
    keyword = keyword.trim();

    // Query mengambil status pengerjaan KHUSUS BULAN DAN TAHUN INI
    let sql = `
        SELECT d.*, 
        (SELECT status_PMC FROM histories h 
         WHERE h.device_id = d.device_id 
         AND h.pmc_type = 'Bulanan'
         AND MONTH(h.tanggal_cek) = MONTH(CURDATE()) 
         AND YEAR(h.tanggal_cek) = YEAR(CURDATE())
         ORDER BY h.riwayat_id DESC LIMIT 1) as status_terakhir
        FROM devices d
        WHERE d.pmc_category = 'Bulanan'
    `;

    let params = [];
    if (keyword !== "") {
        sql += " AND (d.checked_out LIKE ? OR d.model LIKE ? OR d.serial_number LIKE ?)";
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); 
    }

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).send("DB Error: " + err.message);
        res.render("pages/dataBulanan", {
            title: "Monitoring Bulanan",
            layout: "layouts/main",
            css: "dataDevice.css",
            active: "bulanan",
            user: req.session.user,
            devices: results,
            keyword: keyword,
            periode: new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })
        });
    });
});

// ==================================================
// 2. FORM TAMBAH
// ==================================================
router.get('/tambah', (req, res) => {
    res.render("pages/tambahBulanan", { 
        title: "Tambah Data Bulanan", 
        layout: "layouts/main", 
        css: "edit.css", 
        active: "bulanan",
        user: req.session.user 
    });
});

// ==================================================
// 3. PROSES SIMPAN (POST)
// ==================================================
router.post('/tambah', (req, res) => {
    const { device_type, no, model, serial_number, cocd, lokasi, employee_no, checked_out, hostname, status_pmc } = req.body;
    const idTeknisi = req.session.user ? req.session.user.id : null;

    // Masukkan ke devices dengan kategori 'Bulanan'
    const sqlInsert = `INSERT INTO devices (device_type, no, model, serial_number, cocd, lokasi, employee_no, checked_out, hostname, pmc_category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Bulanan')`;
    const values = [device_type, no, model, serial_number, cocd || '-', lokasi || '-', employee_no || '-', checked_out || '-', hostname];

    db.query(sqlInsert, values, (err, result) => {
        if (err) return res.status(500).send("Gagal Simpan Device: " + err.message);
        
        // Simpan history dengan pmc_type 'Bulanan' agar muncul di dashboard
        const sqlHist = `INSERT INTO histories (device_id, pmc_type, tahun, status_PMC, tanggal_cek, action_type, checked_by) VALUES (?, 'Bulanan', YEAR(NOW()), ?, NOW(), 'Add', ?)`;
        db.query(sqlHist, [result.insertId, status_pmc || 'Pending', idTeknisi], (errHist) => {
            res.redirect('/bulanan');
        });
    });
});

// ==================================================
// 4. DETAIL BULANAN
// ==================================================
router.get('/detail/:id', (req, res) => {
    const id = req.params.id;
    const sql = `
        SELECT d.*, 
        (SELECT status_PMC FROM histories h 
         WHERE h.device_id = d.device_id 
         AND h.pmc_type = 'Bulanan'
         AND MONTH(h.tanggal_cek) = MONTH(CURDATE()) 
         AND YEAR(h.tanggal_cek) = YEAR(CURDATE())
         ORDER BY h.riwayat_id DESC LIMIT 1) as status_sekarang
        FROM devices d WHERE d.device_id = ?
    `;

    db.query(sql, [id], (err, results) => {
        if (err || results.length === 0) return res.redirect('/bulanan');
        const data = results[0];
        res.render("pages/detailBulanan", { 
            title: "Detail Bulanan", layout: "layouts/main", css: "detail.css", active: "bulanan", user: req.session.user,
            pmc: {
                id: data.device_id, device_type: data.device_type, model: data.model, serial: data.serial_number,
                employee_no: data.employee_no || '-', checked_out: data.checked_out || '-',
                cocd: data.cocd || '-', hostname: data.hostname || '-', lokasi: data.lokasi || '-',
                pmc_category: data.pmc_category, status_pmc: data.status_sekarang || 'Pending'
            }
        });
    });
});

// ==================================================
// 5. HALAMAN FORM EDIT
// ==================================================
router.get('/detail/edit/:id', (req, res) => {
    const id = req.params.id;
    db.query("SELECT * FROM devices WHERE device_id = ?", [id], (err, results) => {
        if (err || results.length === 0) return res.redirect('/bulanan');
        const data = results[0];

        // Ambil status bulan ini
        db.query("SELECT status_PMC FROM histories WHERE device_id = ? AND pmc_type = 'Bulanan' AND MONTH(tanggal_cek) = MONTH(CURDATE()) AND YEAR(tanggal_cek) = YEAR(CURDATE()) ORDER BY riwayat_id DESC LIMIT 1", [id], (errH, resH) => {
            data.status_pmc = (resH.length > 0) ? resH[0].status_PMC : 'Pending';
            res.render("pages/editBulanan", { 
                title: "Edit Bulanan", layout: "layouts/main", css: "edit.css", active: "bulanan", user: req.session.user, device: data 
            });
        });
    });
});

// ==================================================
// 6. PROSES UPDATE DATA
// ==================================================
router.post('/detail/update/:id', (req, res) => {
    const id = req.params.id;
    const idTeknisi = req.session.user ? req.session.user.id : null;
    const { no, model, serial_number, cocd, lokasi, employee_no, checked_out, hostname, device_type, status_pmc } = req.body; 

    const sqlUpdate = `UPDATE devices SET no=?, model=?, serial_number=?, cocd=?, lokasi=?, employee_no=?, checked_out=?, hostname=?, device_type=?, pmc_category='Bulanan' WHERE device_id=?`;
    
    db.query(sqlUpdate, [no, model, serial_number, cocd, lokasi, employee_no, checked_out, hostname, device_type, id], (err) => {
        if (err) return res.status(500).send("Gagal Update Device");

        // Cek apakah bulan ini sudah ada history
        const sqlCheck = "SELECT riwayat_id FROM histories WHERE device_id = ? AND pmc_type = 'Bulanan' AND MONTH(tanggal_cek) = MONTH(CURDATE()) AND YEAR(tanggal_cek) = YEAR(CURDATE())";
        db.query(sqlCheck, [id], (errC, resC) => {
            if (resC.length > 0) {
                db.query("UPDATE histories SET status_PMC = ?, tanggal_cek = NOW(), action_type = 'Update', checked_by = ? WHERE riwayat_id = ?", [status_pmc, idTeknisi, resC[0].riwayat_id]);
            } else {
                db.query("INSERT INTO histories (device_id, pmc_type, tahun, status_PMC, tanggal_cek, action_type, checked_by) VALUES (?, 'Bulanan', YEAR(NOW()), ?, NOW(), 'Update', ?)", [id, status_pmc, idTeknisi]);
            }
            res.redirect(`/bulanan/detail/${id}`);
        });
    });
});

// ==================================================
// 7. PROSES HAPUS DATA
// ==================================================
router.post('/detail/delete/:id', (req, res) => {
    const id = req.params.id;
    db.query("SELECT model, serial_number FROM devices WHERE device_id = ?", [id], (err, results) => {
        if (err || results.length === 0) return res.redirect('/bulanan');
        const infoBackup = `${results[0].model} (${results[0].serial_number})`; 

        db.query("INSERT INTO histories (device_id, pmc_type, tahun, status_PMC, tanggal_cek, action_type, info_backup) VALUES (NULL, 'Bulanan', YEAR(NOW()), 'Done', NOW(), 'Delete', ?)", [infoBackup], () => {
            db.query("DELETE FROM devices WHERE device_id = ?", [id], () => {
                res.redirect('/bulanan');
            });
        });
    });
});

// ==================================================
// 8. BULK UPDATE STATUS (DONE/PENDING SEMUA)
// ==================================================
router.post('/bulk-update', async (req, res) => {
    const { ids, status } = req.body;
    const idTeknisi = req.session.user ? req.session.user.id : null;

    if (!ids || ids.length === 0) return res.json({ success: false });

    try {
        for (const id of ids) {
            const sqlCheck = "SELECT riwayat_id FROM histories WHERE device_id = ? AND pmc_type = 'Bulanan' AND MONTH(tanggal_cek) = MONTH(CURDATE()) AND YEAR(tanggal_cek) = YEAR(CURDATE())";
            const [rows] = await db.promise().query(sqlCheck, [id]);

            if (rows.length > 0) {
                await db.promise().query("UPDATE histories SET status_PMC = ?, tanggal_cek = NOW(), action_type = 'Bulk Update', checked_by = ? WHERE riwayat_id = ?", [status, idTeknisi, rows[0].riwayat_id]);
            } else {
                await db.promise().query("INSERT INTO histories (device_id, pmc_type, tahun, status_PMC, tanggal_cek, action_type, checked_by) VALUES (?, 'Bulanan', YEAR(NOW()), ?, NOW(), 'Bulk Update', ?)", [id, status, idTeknisi]);
            }
        }
        res.json({ success: true });
    } catch (err) { res.json({ success: false, message: err.message }); }
});

module.exports = router;
const express = require("express"); 
const router = express.Router();    
const db = require("../config/database");

// ==================================================
// 1. LIST HARIAN + CARI (Hanya menampilkan jadwal_PMC = 'Harian')
// ==================================================
router.get("/", (req, res) => {
  const { keyword } = req.query;

  let sql = `
    SELECT d.*, 
    COALESCE(
        (SELECT status_PMC FROM histories h 
         WHERE h.device_id = d.device_id 
         AND DATE(h.tanggal_cek) = CURDATE() -- Kuncinya di sini
         ORDER BY h.riwayat_id DESC LIMIT 1),
        'Pending'
    ) as status_terakhir
    FROM devices d
    WHERE d.jadwal_PMC = 'Harian'
  `;


  let params = [];
  if (keyword) {
    sql += " AND (d.model LIKE ? OR d.serial_number LIKE ? OR d.no LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).send("DB Error");
    res.render("pages/harian", {
      title: "Monitoring Harian",
      layout: "layouts/main",
      css: "dataDevice.css",
      active: "harian",
      user: req.session.user,
      devices: results,
      keyword: keyword || "",
      periode: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    });
  });
});

// ==================================================
// 2. FORM TAMBAH
// ==================================================
router.get('/tambah', (req, res) => {
    res.render("pages/tambahHarian", { 
        title: "Tambah Data Harian", 
        layout: "layouts/main", 
        css: "edit.css", 
        active: "harian",
        user: req.session.user 
    });
});

// ==================================================
// 3. PROSES SIMPAN (Mengunci jadwal_PMC = 'Harian')
// ==================================================
router.post('/tambah', (req, res) => {
    const { 
        device_type, no, model, serial_number, 
        cocd, lokasi, employee_no, checked_out, 
        hostname, status_pmc 
    } = req.body;
    
    const idTeknisi = req.session.user ? req.session.user.id : null;

    const sqlInsert = `
        INSERT INTO devices 
        (device_type, no, model, serial_number, cocd, lokasi, employee_no, checked_out, hostname, jadwal_PMC) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Harian')
    `;
    
    const values = [device_type, no, model, serial_number, cocd || '-', lokasi || '-', employee_no || '-', checked_out || '-', hostname];

    db.query(sqlInsert, values, (err, result) => {
        if (err) return res.status(500).send("Gagal Simpan: " + err.message);
        
        const sqlHist = `
            INSERT INTO histories (device_id, tahun, status_PMC, tanggal_cek, action_type, checked_by) 
            VALUES (?, YEAR(NOW()), ?, NOW(), 'Add', ?)
        `;
        
        db.query(sqlHist, [result.insertId, status_pmc, idTeknisi], (errHist) => {
            if (errHist) console.error("Error History:", errHist.message);
            res.redirect('/harian');
        });
    });
});

// ==================================================
// 4. DETAIL HARIAN
// ==================================================
router.get('/detail/:id', (req, res) => {
    const id = req.params.id;
    const sql = `
        SELECT d.*, 
        (SELECT status_PMC FROM histories h WHERE h.device_id = d.device_id AND DATE(h.tanggal_cek) = CURDATE() ORDER BY h.riwayat_id DESC LIMIT 1) as status_sekarang
        FROM devices d WHERE d.device_id = ?
    `;
    db.query(sql, [id], (err, results) => {
        if (err || results.length === 0) return res.redirect('/harian');
        const data = results[0];
        res.render("pages/detailHarian", { 
            title: "Detail Harian", layout: "layouts/main", css: "detail.css", active: "harian", user: req.session.user,
            pmc: {
                id: data.device_id, device_type: data.device_type, model: data.model, serial: data.serial_number,
                employee_no: data.employee_no || '-', checked_out: data.checked_out || '-',
                cocd: data.cocd || '-', hostname: data.hostname || '-', lokasi: data.lokasi || '-',
                jadwal_pmc: data.jadwal_PMC, status_pmc: data.status_sekarang || 'Pending'
            }
        });
    });
});

// ==================================================
// 5. HALAMAN EDIT
// ==================================================
router.get('/detail/edit/:id', (req, res) => {
    const id = req.params.id;
    db.query("SELECT * FROM devices WHERE device_id = ?", [id], (err, results) => {
        if (err || results.length === 0) return res.redirect('/harian');
        const data = results[0];
        db.query("SELECT status_PMC FROM histories WHERE device_id = ? AND DATE(tanggal_cek) = CURDATE() ORDER BY riwayat_id DESC LIMIT 1", [id], (errH, resH) => {
            data.status_pmc = (resH.length > 0) ? resH[0].status_PMC : 'Pending';
            res.render("pages/editHarian", { 
                title: "Edit Harian", layout: "layouts/main", css: "edit.css", active: "harian", user: req.session.user, device: data 
            });
        });
    });
});

// ==================================================
// 6. PROSES UPDATE (Mengunci jadwal_PMC = 'Harian')
// ==================================================
router.post('/detail/update/:id', (req, res) => {
    const id = req.params.id;
    const idTeknisi = req.session.user ? req.session.user.id : null;
    const { no, model, serial_number, cocd, lokasi, employee_no, checked_out, hostname, device_type, status_pmc } = req.body; 

    // PENTING: jadwal_PMC tetap diset 'Harian' agar tidak pindah ke data laptop/pc
    const sqlUpdate = `
        UPDATE devices 
        SET no=?, model=?, serial_number=?, cocd=?, lokasi=?, employee_no=?, checked_out=?, hostname=?, device_type=?, jadwal_PMC='Harian' 
        WHERE device_id=?
    `;
    
    db.query(sqlUpdate, [no, model, serial_number, cocd, lokasi, employee_no, checked_out, hostname, device_type, id], (err) => {
        if (err) return res.status(500).send("Gagal Update: " + err.message);

        const sqlCheck = "SELECT riwayat_id FROM histories WHERE device_id = ? AND DATE(tanggal_cek) = CURDATE()";
        db.query(sqlCheck, [id], (errC, resC) => {
            if (resC.length > 0) {
                db.query("UPDATE histories SET status_PMC = ?, tanggal_cek = NOW(), action_type = 'Update', checked_by = ? WHERE device_id = ? AND DATE(tanggal_cek) = CURDATE()", [status_pmc, idTeknisi, id]);
            } else {
                db.query("INSERT INTO histories (device_id, tahun, status_PMC, tanggal_cek, action_type, checked_by) VALUES (?, YEAR(NOW()), ?, NOW(), 'Update', ?)", [id, status_pmc, idTeknisi]);
            }
            res.redirect(`/harian/detail/${id}`);
        });
    });
});

// // ==================================================
// 7. PROSES HAPUS DATA HARIAN (DENGAN BACKUP RIWAYAT)
// ==================================================
router.post('/detail/delete/:id', (req, res) => {
    const id = req.params.id;

    // 1. Ambil info model dan SN untuk cadangan riwayat sebelum data benar-benar dihapus
    db.query("SELECT model, serial_number FROM devices WHERE device_id = ?", [id], (err, results) => {
        if (err || results.length === 0) {
            console.error("Data tidak ditemukan untuk dihapus");
            return res.redirect('/harian');
        }

        const d = results[0];
        const infoBackup = `${d.model} (${d.serial_number})`; 
        const tahun = new Date().getFullYear();

        // 2. Simpan ke history dengan action_type 'Delete' dan device_id NULL
        // Ini supaya di laporan riwayat tetap kelihatan kalau aset ini pernah dihapus
        const sqlHist = `
            INSERT INTO histories 
            (device_id, tahun, status_PMC, tanggal_cek, action_type, info_backup) 
            VALUES (NULL, ?, 'Done', NOW(), 'Delete', ?)
        `;

        db.query(sqlHist, [tahun, infoBackup], (errHist) => {
            if (errHist) console.error("Gagal simpan history hapus:", errHist);

            // 3. Baru hapus data asli dari tabel devices
            db.query("DELETE FROM devices WHERE device_id = ?", [id], (errDel) => {
                if (errDel) {
                    console.error("Gagal Hapus Device:", errDel.message);
                    return res.status(500).send("Gagal Hapus Device");
                }
                
                // Setelah berhasil hapus, arahkan kembali ke list harian
                res.redirect('/harian');
            });
        });
    });
});

// ==================================================
// 8. BULK UPDATE (KHUSUS HARI INI)
// ==================================================
router.post('/bulk-update', async (req, res) => {
    const { ids, status } = req.body;
    const idTeknisi = req.session.user ? req.session.user.id : null;
    if (!ids || ids.length === 0) return res.json({ success: false });

    try {
        for (const id of ids) {
            const sqlCheck = "SELECT riwayat_id FROM histories WHERE device_id = ? AND DATE(tanggal_cek) = CURDATE()";
            const [rows] = await db.promise().query(sqlCheck, [id]);

            if (rows.length > 0) {
                await db.promise().query("UPDATE histories SET status_PMC = ?, tanggal_cek = NOW(), action_type = 'Bulk Update', checked_by = ? WHERE device_id = ? AND DATE(tanggal_cek) = CURDATE()", [status, idTeknisi, id]);
            } else {
                await db.promise().query("INSERT INTO histories (device_id, tahun, status_PMC, tanggal_cek, action_type, checked_by) VALUES (?, YEAR(NOW()), ?, NOW(), 'Bulk Update', ?)", [id, status, idTeknisi]);
            }
        }
        res.json({ success: true });
    } catch (err) { res.json({ success: false, message: err.message }); }
});

module.exports = router;
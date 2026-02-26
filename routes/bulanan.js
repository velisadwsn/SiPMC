const express = require("express"); 
const router = express.Router();    
const db = require("../config/database");

// ==================================================
// 1. LIST BULANAN + CARI
// ==================================================
router.get("/", (req, res) => {
  const { keyword } = req.query;

  let sql = `
    SELECT d.*, 
    COALESCE(
        (SELECT status_PMC FROM histories h 
         WHERE h.device_id = d.device_id 
         AND MONTH(h.tanggal_cek) = MONTH(CURDATE()) -- Cek Bulan Sekarang
         AND YEAR(h.tanggal_cek) = YEAR(CURDATE())   -- Cek Tahun Sekarang
         ORDER BY h.riwayat_id DESC LIMIT 1),
        'Pending'
    ) as status_terakhir
    FROM devices d
    WHERE d.jadwal_PMC = 'Bulanan'
`;

  let params = [];
  if (keyword) {
    sql += " AND (d.model LIKE ? OR d.serial_number LIKE ? OR d.no LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).send("DB Error");
    res.render("pages/bulanan", {
      title: "Monitoring Bulanan",
      layout: "layouts/main",
      css: "dataDevice.css",
      active: "bulanan",
      user: req.session.user,
      devices: results,
      keyword: keyword || "",
      periode: new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })
    });
  });
});

// ==================================================
// 2. FORM TAMBAH DATA (INI YANG TADI KURANG)
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
// 3. PROSES SIMPAN DATA (POST)
// ==================================================
router.post('/tambah', (req, res) => {
    // 1. Destructuring data dari form
    const { 
        device_type, no, model, serial_number, 
        cocd, lokasi, employee_no, checked_out, 
        hostname, jadwal_PMC, status_pmc 
    } = req.body;
    
    const idTeknisi = req.session.user ? req.session.user.id : null;

    // 2. Query INSERT ke tabel devices (10 Kolom)
    const sqlInsert = `
        INSERT INTO devices 
        (device_type, no, model, serial_number, cocd, lokasi, employee_no, checked_out, hostname, jadwal_PMC) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    // 3. Pastikan ada 10 data di array ini sesuai urutan kolom di atas
    const values = [
        device_type,        // 1
        no,                 // 2
        model,              // 3
        serial_number,      // 4
        cocd || '-',        // 5
        lokasi || '-',      // 6
        employee_no || '-', // 7
        checked_out || '-', // 8
        hostname,           // 9
        jadwal_PMC          // 10
    ];

    db.query(sqlInsert, values, (err, result) => {
        if (err) {
            console.error("Error SQL Devices:", err.message);
            return res.status(500).send("Gagal Simpan Device: " + err.message);
        }
        
        // 4. Record history pertama (Gunakan status_pmc dari form)
        const sqlHist = `
            INSERT INTO histories (device_id, tahun, status_PMC, tanggal_cek, action_type, checked_by) 
            VALUES (?, YEAR(NOW()), ?, NOW(), 'Add', ?)
        `;
        
        db.query(sqlHist, [result.insertId, status_pmc, idTeknisi], (errHist) => {
            if (errHist) console.error("Error History:", errHist.message);
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
        SELECT d.*, h.status_PMC, h.tanggal_cek FROM devices d 
        LEFT JOIN histories h ON d.device_id = h.device_id 
        AND MONTH(h.tanggal_cek) = MONTH(CURDATE()) AND YEAR(h.tanggal_cek) = YEAR(CURDATE())
        WHERE d.device_id = ? ORDER BY h.riwayat_id DESC LIMIT 1
    `;
    db.query(sql, [id], (err, results) => {
        if (err || results.length === 0) return res.redirect('/bulanan');
        const data = results[0];
        res.render("pages/detailBulanan", { 
            title: "Detail Bulanan", 
            layout: "layouts/main", 
            css: "detail.css", 
            active: "bulanan", 
            user: req.session.user,
            pmc: {
                id: data.device_id,
                device_type: data.device_type,
                model: data.model,
                serial: data.serial_number,
                employee_no: data.employee_no || '-',
                checked_out: data.checked_out || '-',
                cocd: data.cocd || '-',
                hostname: data.hostname || '-',
                lokasi: data.lokasi || '-',
                jadwal_pmc: data.jadwal_PMC,
                status_pmc: data.status_PMC || 'Pending'
            }
        });
    });
});

// ==================================================
// 5. HALAMAN FORM EDIT
// ==================================================
router.get('/detail/edit/:id', (req, res) => {
    const id = req.params.id;
    
    // Ambil data device
    db.query("SELECT * FROM devices WHERE device_id = ?", [id], (err, results) => {
        if (err || results.length === 0) return res.redirect('/bulanan');
        const data = results[0];

        // Ambil status terakhir dari history
        db.query("SELECT status_PMC FROM histories WHERE device_id = ? ORDER BY riwayat_id DESC LIMIT 1", [id], (errHist, resultHist) => {
            let lastStatus = (resultHist && resultHist.length > 0) ? resultHist[0].status_PMC : 'Pending';
            
            data.status_pmc = lastStatus;
            
            res.render("pages/editBulanan", { 
                title: "Edit Data Bulanan", 
                layout: "layouts/main", 
                css: "edit.css", 
                active: "bulanan", 
                user: req.session.user,
                device: data 
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

    // PAKSA jadwal_PMC='Bulanan' agar tidak berubah jadi Harian atau nama bulan
    const sqlUpdate = `
        UPDATE devices 
        SET no=?, model=?, serial_number=?, cocd=?, lokasi=?, employee_no=?, checked_out=?, hostname=?, device_type=?, jadwal_PMC='Bulanan' 
        WHERE device_id=?
    `;
    
    const values = [no, model, serial_number, cocd, lokasi, employee_no, checked_out, hostname, device_type, id];

    db.query(sqlUpdate, values, (err) => {
        if (err) return res.status(500).send("Gagal Update");

        const tahun = new Date().getFullYear();
        const sqlCheck = "SELECT riwayat_id FROM histories WHERE device_id = ? AND tahun = ?";
        
        db.query(sqlCheck, [id, tahun], (errCheck, resultCheck) => {
            if (resultCheck.length > 0) {
                db.query("UPDATE histories SET status_PMC = ?, tanggal_cek = NOW(), action_type = 'Update', checked_by = ? WHERE device_id = ? AND tahun = ?", [status_pmc, idTeknisi, id, tahun], () => {
                    res.redirect(`/bulanan/detail/${id}`);
                });
            } else {
                db.query("INSERT INTO histories (device_id, tahun, status_PMC, tanggal_cek, action_type, checked_by) VALUES (?, ?, ?, NOW(), 'Update', ?)", [id, tahun, status_pmc, idTeknisi], () => {
                    res.redirect(`/bulanan/detail/${id}`);
                });
            }
        });
    });
});

// ==================================================
// 7. PROSES HAPUS DATA (DENGAN RIWAYAT)
// ==================================================
router.post('/detail/delete/:id', (req, res) => {
    const id = req.params.id;

    // 1. Ambil info model dan SN untuk cadangan riwayat sebelum dihapus
    db.query("SELECT model, serial_number FROM devices WHERE device_id = ?", [id], (err, results) => {
        if (err || results.length === 0) return res.redirect('/bulanan');

        const d = results[0];
        const infoBackup = `${d.model} (${d.serial_number})`; 
        const tahun = new Date().getFullYear();

        // 2. Simpan ke history dengan action_type 'Delete' dan device_id NULL
        const sqlHist = `
            INSERT INTO histories 
            (device_id, tahun, status_PMC, tanggal_cek, action_type, info_backup) 
            VALUES (NULL, ?, 'Done', NOW(), 'Delete', ?)
        `;

        db.query(sqlHist, [tahun, infoBackup], (errHist) => {
            if (errHist) console.error("Gagal simpan history hapus:", errHist);

            // 3. Baru hapus data asli dari tabel devices
            db.query("DELETE FROM devices WHERE device_id = ?", [id], (errDel) => {
                if (errDel) return res.status(500).send("Gagal Hapus Device");
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
    const tahun = new Date().getFullYear();

    if (!ids || ids.length === 0) {
        return res.json({ success: false, message: "Tidak ada data dipilih" });
    }

    try {
        // Kita gunakan perulangan untuk update/insert history tiap device
        for (const id of ids) {
            const sqlCheck = "SELECT riwayat_id FROM histories WHERE device_id = ? AND tahun = ?";
            const [rows] = await db.promise().query(sqlCheck, [id, tahun]);

            if (rows.length > 0) {
                // Jika sudah ada record tahun ini, update
                await db.promise().query(
                    "UPDATE histories SET status_PMC = ?, tanggal_cek = NOW(), action_type = 'Bulk Update', checked_by = ? WHERE device_id = ? AND tahun = ?",
                    [status, idTeknisi, id, tahun]
                );
            } else {
                // Jika belum ada, insert baru
                await db.promise().query(
                    "INSERT INTO histories (device_id, tahun, status_PMC, tanggal_cek, action_type, checked_by) VALUES (?, ?, ?, NOW(), 'Bulk Add', ?)",
                    [id, tahun, status, idTeknisi]
                );
            }
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: err.message });
    }
});

module.exports = router;
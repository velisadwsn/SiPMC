const express = require("express");
const router = express.Router();
const db = require("../config/database");

// ==================================================
// 1. HALAMAN UTAMA (LIST PC)
// ==================================================
router.get("/", (req, res) => {
  let bulan = req.query.bulan || "";
  let keyword = req.query.keyword || "";

  keyword = keyword.trim();

  let sql = `
    SELECT d.*, 
    COALESCE(
        (SELECT status_PMC FROM histories h WHERE h.device_id = d.device_id ORDER BY h.riwayat_id DESC LIMIT 1),
        'Pending'
    ) as status_terakhir
    FROM devices d 
    WHERE d.device_type = 'PC' 
    AND d.jadwal_PMC NOT IN ('Bulanan', 'Harian') 
  `;

  let params = [];

  // 1. Filter Bulan
  if (bulan !== "") {
      sql += " AND d.jadwal_PMC LIKE ?";
      params.push(`%${bulan}%`);
  }

  // 2. Filter Carian Kata Kunci
  if (keyword !== "") {
      sql += " AND (d.checked_out LIKE ? OR d.model LIKE ? OR d.serial_number LIKE ?)";
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); 
  }

  db.query(sql, params, (err, results) => {
    if (err) {
        console.error("Error SQL:", err);
        return res.status(500).send("DB Error");
    }
    
    res.render("pages/dataPC", {
      title: "Data PC", 
      layout: "layouts/main", 
      css: "dataDevice.css",
      active: "pc", 
      pcs: results, // Pastikan EJS anda menggunakan 'pcs' atau ikut variabel asal anda
      bulan: bulan, 
      keyword: keyword
    });
  });
});

// ==================================================
// 2. TAMBAH PC
// ==================================================
router.get('/tambah', (req, res) => {
  res.render("pages/tambahPC", { 
    title: "Tambah PC", 
    layout: "layouts/main", 
    css: "edit.css", 
    active: "pc" 
  });
});

router.post('/tambah', (req, res) => {
  const { no, model, serial_number, site, lokasi, employee_no, checked_out, hostname, jadwal_PMC, status_pmc } = req.body;
  const idTeknisi = req.session.user.id; 

  const sqlInsert = "INSERT INTO devices (device_type, no, model, serial_number, site, lokasi, employee_no, checked_out, hostname, jadwal_PMC) VALUES ('PC', ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  const values = [no, model, serial_number, site, lokasi, employee_no, checked_out, hostname, jadwal_PMC];
  
  db.query(sqlInsert, values, (err, result) => {
    if (err) return res.status(500).send(err.message);
    
    const tahun = new Date().getFullYear();
    const infoPerangkat = `${model} ${serial_number}`; 
    
    const sqlHist = `
        INSERT INTO histories 
        (device_id, tahun, status_PMC, tanggal_cek, action_type, info_backup, checked_by) 
        VALUES (?, ?, ?, NOW(), 'Add', ?, ?)
    `;
    
    db.query(sqlHist, [result.insertId, tahun, status_pmc, infoPerangkat, idTeknisi], (errHist) => {
        if (errHist) console.error("Gagal simpan history:", errHist);
        res.redirect('/pc');
    });
  });
});

// ==================================================
// 3. DETAIL PC
// ==================================================
router.get('/detail/:id', (req, res) => {
  const id = req.params.id;

  db.query("SELECT * FROM devices WHERE device_id = ?", [id], (err, results) => {
    if (err || results.length === 0) return res.status(404).send("Not Found");
    const data = results[0];

    const sqlHist = "SELECT status_PMC FROM histories WHERE device_id = ? ORDER BY riwayat_id DESC LIMIT 1";

    db.query(sqlHist, [id], (errHist, resultHist) => {
        let lastStatus = (resultHist && resultHist.length > 0) ? resultHist[0].status_PMC : 'Pending';

        const pmcData = {
          id: data.device_id, no: data.no, model: data.model, employee_no: data.employee_no || '-',
          serial: data.serial_number, checked_out: data.checked_out || '-',
          site: data.site || '-', hostname: data.hostname, lokasi: data.lokasi || '-',
          jadwal_PMC: data.jadwal_PMC, status_pmc: lastStatus
        };

        res.render("pages/detailPC", {
          title: "Detail Perangkat", layout: "layouts/main", css: "detail.css",
          active: "pc", pmc: pmcData, histories: []
        });
    });
  });
});

// ==================================================
// 4. EDIT & UPDATE
// ==================================================
router.get('/detail/edit/:id', (req, res) => {
  const id = req.params.id;
  db.query("SELECT * FROM devices WHERE device_id = ?", [id], (err, results) => {
    if (err || results.length === 0) return res.redirect('/pc');
    const data = results[0];

    db.query("SELECT status_PMC FROM histories WHERE device_id = ? ORDER BY riwayat_id DESC LIMIT 1", [id], (errHist, resultHist) => {
        let lastStatus = (resultHist && resultHist.length > 0) ? resultHist[0].status_PMC : 'Pending';
        data.status_pmc = lastStatus;
        data.location = data.lokasi; 

        res.render("pages/editPC", { 
          title: "Edit PC", layout: "layouts/main", css: "edit.css", active: "pc", pc: data 
        });
    });
  });
});

router.post('/detail/update/:id', (req, res) => {
    const id = req.params.id;
    const idTeknisi = req.session.user.id; 
    const { no, model, serial_number, site, lokasi, employee_no, checked_out, jadwal_PMC, status_pmc } = req.body; 

    const sqlUpdateDevice = "UPDATE devices SET no=?, model=?, serial_number=?, site=?, lokasi=?, employee_no=?, checked_out=?, jadwal_PMC=? WHERE device_id=?";
    const valuesDevice = [no, model, serial_number, site, lokasi, employee_no, checked_out, jadwal_PMC, id];

    db.query(sqlUpdateDevice, valuesDevice, (err) => {
        if (err) return res.status(500).send("Gagal Update: " + err.message);

        const tahun = new Date().getFullYear();
        const sqlCheck = "SELECT riwayat_id FROM histories WHERE device_id = ? AND tahun = ?";
        
        db.query(sqlCheck, [id, tahun], (errCheck, resultCheck) => {
            if (resultCheck.length > 0) {
                db.query("UPDATE histories SET status_PMC = ?, tanggal_cek = NOW(), action_type = 'Update', checked_by = ? WHERE device_id = ? AND tahun = ?", [status_pmc, idTeknisi, id, tahun], () => {
                    res.redirect(`/pc/detail/${id}`);
                });
            } else {
                db.query("INSERT INTO histories (device_id, tahun, status_PMC, tanggal_cek, action_type, checked_by) VALUES (?, ?, ?, NOW(), 'Update', ?)", [id, tahun, status_pmc, idTeknisi], () => {
                    res.redirect(`/pc/detail/${id}`);
                });
            }
        });
    });
});

// ==================================================
// 5. DELETE
// ==================================================
router.post('/detail/delete/:id', (req, res) => {
  const id = req.params.id;
  db.query("SELECT model, serial_number FROM devices WHERE device_id = ?", [id], (err, results) => {
      if (err || results.length === 0) return res.redirect('/pc');
      const infoBackup = `${results[0].model} (${results[0].serial_number})`; 
      db.query("INSERT INTO histories (device_id, tahun, status_PMC, tanggal_cek, action_type, info_backup) VALUES (NULL, YEAR(NOW()), 'Done', NOW(), 'Delete', ?)", [infoBackup], () => {
          db.query("DELETE FROM devices WHERE device_id = ?", [id], () => res.redirect('/pc'));
      });
  });
});

// ==================================================
// 6. BULK UPDATE
// ==================================================
router.post('/bulk-update', async (req, res) => {
    const { ids, status, bulan } = req.body; 
    const tahun = new Date().getFullYear();
    const userId = req.session.user ? req.session.user.id : 1; 

    if (!ids) return res.json({ success: false });

    try {
        for (const id of ids) {
            await new Promise((resolve) => {
                db.query("UPDATE devices SET jadwal_PMC = ? WHERE device_id = ?", [bulan, id], () => {
                    db.query("SELECT riwayat_id FROM histories WHERE device_id = ? AND tahun = ?", [id, tahun], (e, rows) => {
                        if (rows.length > 0) {
                            db.query("UPDATE histories SET status_PMC = ?, tanggal_cek = NOW(), action_type = 'Bulk Update', checked_by = ? WHERE device_id = ? AND tahun = ?", [status, userId, id, tahun], resolve);
                        } else {
                            db.query("INSERT INTO histories (device_id, tahun, status_PMC, tanggal_cek, action_type, checked_by) VALUES (?, ?, ?, NOW(), 'Bulk Update', ?)", [id, tahun, status, userId], resolve);
                        }
                    });
                });
            });
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

module.exports = router;
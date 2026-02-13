const express = require("express");
const router = express.Router();
const db = require("../config/database");

// ==================================================
// 1. HALAMAN UTAMA (LIST LAPTOP + STATUS TERAKHIR)
// ==================================================
router.get("/", (req, res) => {
  const { bulan, keyword } = req.query;

  let sql = `
    SELECT d.*, 
    COALESCE(
        (SELECT status_PMC FROM histories h WHERE h.device_id = d.device_id ORDER BY h.riwayat_id DESC LIMIT 1),
        'Pending'
    ) as status_terakhir
    FROM devices d 
    WHERE d.device_type = 'PC'
  `;
  
  let params = [];

  if (bulan) { sql += " AND d.jadwal_PMC LIKE ?"; params.push(`%${bulan}%`); }
  if (keyword) { sql += " AND (d.no LIKE ? OR d.model LIKE ? OR d.serial_number LIKE ?)"; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).send("DB Error");
    res.render("pages/dataPC", {
      title: "Data PC", layout: "layouts/main", css: "dataDevice.css",
      active: "pc", pcs: results, bulan: bulan || "", keyword: keyword || ""
    });
  });
});

// ==================================================
// 2. TAMBAH PC (CATAT HISTORY 'ADD')
// ==================================================
router.get('/tambah', (req, res) => {
  res.render("pages/tambahPC", { 
    title: "Tambah PC", 
    layout: "layouts/main", 
    css: "edit.css", 
    active: "pc" });
});


router.post('/tambah', (req, res) => {
  const { no, model, serial_number, site, lokasi, employee_no, checked_out, hostname, jadwal_PMC, status_pmc } = req.body;
  const idTeknisi = req.session.user.id; // Ambil ID User

  const sqlInsert = "INSERT INTO devices (device_type, no, model, serial_number, site, lokasi, employee_no, checked_out, hostname, jadwal_PMC) VALUES ('PC', ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  const values = [no, model, serial_number, site, lokasi, employee_no, checked_out, hostname, jadwal_PMC];
  db.query(sqlInsert, values, (err, result) => {
    if (err) return res.status(500).send(err.message);
    
    const tahun = new Date().getFullYear();
    const infoPerangkat = `${model} ${serial_number}`; 
    
    // Tambahkan kolom checked_by di sini
    const sqlHist = `
        INSERT INTO histories 
        (device_id, tahun, status_PMC, tanggal_cek, action_type, info_backup, checked_by) 
        VALUES (?, ?, ?, NOW(), 'Add', ?, ?)
    `;
    
    db.query(sqlHist, [result.insertId, tahun, status_pmc, infoPerangkat, idTeknisi], (errHist) => {
        if (errHist) console.error("Gagal simpan history tambah:", errHist);
        res.redirect('/pc');
    });
  });
});
// ==================================================
// 3. DETAIL PC (BACA STATUS DARI HISTORY)
// ==================================================
router.get('/detail/:id', (req, res) => {
  const id = req.params.id;

  db.query("SELECT * FROM devices WHERE device_id = ?", [id], (err, results) => {
    if (results.length === 0) return res.status(404).send("Not Found");
    const data = results[0];

    const sqlHist = "SELECT status_PMC FROM histories WHERE device_id = ? ORDER BY riwayat_id DESC LIMIT 1";

    db.query(sqlHist, [id], (errHist, resultHist) => {
        let lastStatus = 'Pending';
        if (resultHist && resultHist.length > 0) {
           lastStatus = resultHist[0].status_PMC;
        }

        const pmcData = {
          id: data.device_id, no: data.no, model: data.model, employee_no: data.employee_no || '-',
          serial: data.serial_number, checked_out: data.checked_out || '-',
          site: data.site || '-', hostname: data.hostname, lokasi: data.lokasi || '-',
          
          // Kirim dua versi biar aman di EJS
          jadwal_PMC: data.jadwal_PMC, 
          jadwal_pmc: data.jadwal_PMC, 
          
          status_pmc: lastStatus
        };

        res.render("pages/detailPC", {
          title: "Detail Perangkat", layout: "layouts/main", css: "detail.css",
          active: "pc", pmc: pmcData, histories: []
        });
    });
  });
});

// ==================================================
// 4. EDIT FORM
// ==================================================
router.get('/detail/edit/:id', (req, res) => {
  const id = req.params.id;
  db.query("SELECT * FROM devices WHERE device_id = ?", [id], (err, results) => {
    const data = results[0];

    db.query("SELECT status_PMC FROM histories WHERE device_id = ? ORDER BY riwayat_id DESC LIMIT 1", [id], (errHist, resultHist) => {
        let lastStatus = 'Pending';
        if (resultHist && resultHist.length > 0) {
            lastStatus = resultHist[0].status_PMC;
        }
        
        data.status_pmc = lastStatus;
        data.location = data.lokasi; 

        res.render("pages/editPC", { 
          title: "Edit PC", layout: "layouts/main", css: "edit.css", active: "pc", pc: data 
        });
    });
  });
});

// ==================================================
// 5. UPDATE (FIX: MENGUBAH LABEL 'ADD' JADI 'UPDATE')
// ==================================================
router.post('/detail/update/:id', (req, res) => {
    const id = req.params.id;
    // 1. Ambil ID User dari session
    const idTeknisi = req.session.user.id; 
    const { no, model, serial_number, site, lokasi, employee_no, checked_out, jadwal_PMC, status_pmc } = req.body; 

    const sqlUpdateDevice = "UPDATE devices SET no=?, model=?, serial_number=?, site=?, lokasi=?, employee_no=?, checked_out=?, jadwal_PMC=? WHERE device_id=?";
    const valuesDevice = [no, model, serial_number, site, lokasi, employee_no, checked_out, jadwal_PMC, id];

    db.query(sqlUpdateDevice, valuesDevice, (err) => {
        if (err) return res.status(500).send("Gagal Update Device: " + err.message);

        const tahun = new Date().getFullYear();
        const sqlCheck = "SELECT riwayat_id FROM histories WHERE device_id = ? AND tahun = ?";
        
        db.query(sqlCheck, [id, tahun], (errCheck, resultCheck) => {
            if (errCheck) return res.redirect(`/pc/detail/${id}`);

            if (resultCheck.length > 0) {
                // A. UPDATE: Tambahkan checked_by = ?
                const sqlUpdateHist = `
                    UPDATE histories 
                    SET status_PMC = ?, tanggal_cek = NOW(), action_type = 'Update', checked_by = ? 
                    WHERE device_id = ? AND tahun = ?
                `;
                
                db.query(sqlUpdateHist, [status_pmc, idTeknisi, id, tahun], (errUpdate) => {
                    if(errUpdate) console.error("Update History Error:", errUpdate);
                    res.redirect(`/pc/detail/${id}`);
                });

            } else {
                // B. INSERT BARU: Tambahkan checked_by ke kolom
                const sqlInsertHist = "INSERT INTO histories (device_id, tahun, status_PMC, tanggal_cek, action_type, checked_by) VALUES (?, ?, ?, NOW(), 'Update', ?)";
                
                db.query(sqlInsertHist, [id, tahun, status_pmc, idTeknisi], (errInsert) => {
                    if(errInsert) console.error("Insert History Error:", errInsert);
                    res.redirect(`/pc/detail/${id}`);
                });
            }
        });
    });
});

// ==================================================
// 6. DELETE (VERSI FIX: PAKE NULL)
// ==================================================
router.post('/detail/delete/:id', (req, res) => {
  const id = req.params.id;

  db.query("SELECT model, serial_number FROM devices WHERE device_id = ?", [id], (err, results) => {
      if (err || results.length === 0) return res.redirect('/pc');

      const d = results[0];
      const infoBackup = `${d.model} (${d.serial_number})`; 
      const tahun = new Date().getFullYear();

      // Fix: Gunakan NULL pada device_id
      const sqlHist = `
        INSERT INTO histories 
        (device_id, tahun, status_PMC, tanggal_cek, action_type, info_backup) 
        VALUES (NULL, ?, 'Done', NOW(), 'Delete', ?)
      `;

      db.query(sqlHist, [tahun, infoBackup], (errHist) => {
          if (errHist) console.error("Gagal simpan history hapus:", errHist);

          db.query("DELETE FROM devices WHERE device_id = ?", [id], () => {
              res.redirect('/pc');
          });
      });
  });
});

// ==================================================
// FITUR: BULK UPDATE PC (SINKRON DENGAN LAPORAN)
// ==================================================
router.post('/bulk-update', async (req, res) => {
    const { ids, status, bulan } = req.body; 
    const tahun = new Date().getFullYear();
    
    // Ambil ID User dari session (Default ke 1 jika session kosong)
    const userId = req.session.user ? req.session.user.id : 1; 

    if (!ids || ids.length === 0) {
        return res.json({ success: false, message: "Tidak ada data yang dipilih" });
    }

    try {
        for (const id of ids) {
            await new Promise((resolve, reject) => {
                
                // 1. UPDATE TABEL DEVICES (SINKRONISASI JADWAL_PMC)
                // Ini supaya data yang di-bulk update langsung muncul di laporan bulan tersebut
                const sqlUpdateDevice = "UPDATE devices SET jadwal_PMC = ? WHERE device_id = ?";
                db.query(sqlUpdateDevice, [bulan, id], (errDev) => {
                    if (errDev) console.error("Gagal update jadwal_PMC di devices:", errDev);

                    // 2. AMBIL INFO UNTUK BACKUP HISTORY
                    const sqlInfo = "SELECT model, serial_number FROM devices WHERE device_id = ?";
                    db.query(sqlInfo, [id], (errInfo, resInfo) => {
                        if (errInfo) return reject(errInfo);
                        const infoBackup = resInfo.length > 0 ? `${resInfo[0].model} ${resInfo[0].serial_number}` : 'Unknown PC';

                        // 3. CEK APAKAH HISTORY TAHUN INI SUDAH ADA
                        const sqlCheck = "SELECT riwayat_id FROM histories WHERE device_id = ? AND tahun = ?";
                        db.query(sqlCheck, [id, tahun], (errCheck, rows) => {
                            if (errCheck) return reject(errCheck);

                            if (rows.length > 0) {
                                // UPDATE HISTORY YANG SUDAH ADA
                                const sqlUpdateHist = `
                                    UPDATE histories 
                                    SET status_PMC = ?, 
                                        tanggal_cek = NOW(), 
                                        action_type = 'Bulk Update',
                                        checked_by = ? 
                                    WHERE device_id = ? AND tahun = ?
                                `;
                                db.query(sqlUpdateHist, [status, userId, id, tahun], (errUp) => {
                                    if (errUp) reject(errUp);
                                    else resolve();
                                });
                            } else {
                                // INSERT HISTORY BARU
                                const sqlInsertHist = `
                                    INSERT INTO histories 
                                    (device_id, tahun, status_PMC, tanggal_cek, action_type, info_backup, checked_by) 
                                    VALUES (?, ?, ?, NOW(), 'Bulk Update', ?, ?)
                                `;
                                db.query(sqlInsertHist, [id, tahun, status, infoBackup, userId], (errIn) => {
                                    if (errIn) reject(errIn);
                                    else resolve();
                                });
                            }
                        });
                    });
                });
            });
        }
        res.json({ success: true });
    } catch (error) {
        console.error("Bulk Update PC Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
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
    WHERE d.device_type = 'Laptop'
  `;
  
  let params = [];

  if (bulan) { sql += " AND d.jadwal_PMC LIKE ?"; params.push(`%${bulan}%`); }
  if (keyword) { sql += " AND (d.no LIKE ? OR d.model LIKE ? OR d.serial_number LIKE ?)"; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).send("DB Error");
    res.render("pages/dataLaptop", {
      title: "Data Laptop", layout: "layouts/main", css: "dataDevice.css",
      active: "laptop", laptops: results, bulan: bulan || "", keyword: keyword || ""
    });
  });
});

// ==================================================
// 2. TAMBAH LAPTOP (CATAT HISTORY 'ADD')
// ==================================================
router.get('/tambah', (req, res) => {
  res.render("pages/tambahLaptop", { title: "Tambah Laptop", layout: "layouts/main", css: "edit.css", active: "laptop" });
});

router.post('/tambah', (req, res) => {
  // Ambil data dari body (Pastikan di EJS name="no" dan name="hostname")
  const { no, model, serial_number, cocd, lokasi, employee_no, checked_out, hostname, jadwal_PMC, status_pmc } = req.body;
  const idTeknisi = req.session.user.id; 
  
  const sqlInsert = `
    INSERT INTO devices 
    (device_type, no, model, serial_number, cocd, lokasi, employee_no, checked_out, hostname, jadwal_PMC) 
    VALUES ('Laptop', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  // Urutan values harus sama dengan urutan kolom di atas
  const values = [no, model, serial_number, cocd, lokasi, employee_no, checked_out, hostname, jadwal_PMC];

  db.query(sqlInsert, values, (err, result) => {
    if (err) return res.status(500).send("Gagal Tambah Device: " + err.message);
    
    const tahun = new Date().getFullYear();
    const infoPerangkat = `${model} (${serial_number})`; 
    
    const sqlHist = `
        INSERT INTO histories 
        (device_id, tahun, status_PMC, tanggal_cek, action_type, info_backup, checked_by) 
        VALUES (?, ?, ?, NOW(), 'Add', ?, ?)
    `;
    
    db.query(sqlHist, [result.insertId, tahun, status_pmc, infoPerangkat, idTeknisi], (errHist) => {
        if (errHist) console.error("Gagal simpan history tambah:", errHist);
        res.redirect('/laptop');
    });
  });
});

// ==================================================
// 3. DETAIL LAPTOP (BACA STATUS DARI HISTORY)
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
          cocd: data.cocd || '-', hostname: data.hostname, lokasi: data.lokasi || '-',
          
          // Kirim dua versi biar aman di EJS
          jadwal_PMC: data.jadwal_PMC, 
          jadwal_pmc: data.jadwal_PMC, 
          
          status_pmc: lastStatus
        };

        res.render("pages/detailLaptop", {
          title: "Detail Perangkat", layout: "layouts/main", css: "detail.css",
          active: "laptop", pmc: pmcData, histories: []
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

        res.render("pages/editLaptop", { 
          title: "Edit Laptop", layout: "layouts/main", css: "edit.css", active: "laptop", laptop: data 
        });
    });
  });
});

// ==================================================
// 5. UPDATE (FIX: MENGUBAH LABEL 'ADD' JADI 'UPDATE')
// ==================================================
router.post('/detail/update/:id', (req, res) => {
  const id = req.params.id;
  const idTeknisi = req.session.user.id; // Pastikan session user sudah ada
  
  // 1. Ambil SEMUA data dari body sesuai dengan atribut 'name' di EJS
  const { no, model, serial_number, cocd, lokasi, employee_no, checked_out, hostname, jadwal_PMC, status_pmc } = req.body; 

  // 2. Perbaiki SQL Update: Pastikan 'no' dan 'hostname' masuk hitungan
  const sqlUpdateDevice = `
    UPDATE devices 
    SET no=?, model=?, serial_number=?, cocd=?, lokasi=?, employee_no=?, checked_out=?, hostname=?, jadwal_PMC=? 
    WHERE device_id=?
  `;
  
  // 3. Urutan Array VALUES harus 100% sama dengan urutan tanda tanya (?) di atas
  const valuesDevice = [no, model, serial_number, cocd, lokasi, employee_no, checked_out, hostname, jadwal_PMC, id];

  db.query(sqlUpdateDevice, valuesDevice, (err) => {
    if (err) {
      console.error("Gagal Update Device:", err);
      return res.status(500).send("Gagal Update Device: " + err.message);
    }

    const tahun = new Date().getFullYear();
    const sqlCheck = "SELECT riwayat_id FROM histories WHERE device_id = ? AND tahun = ?";
    
    db.query(sqlCheck, [id, tahun], (errCheck, resultCheck) => {
        if (errCheck) return res.redirect(`/laptop/detail/${id}`);

        if (resultCheck.length > 0) {
            // A. UPDATE HISTORY: Masukkan ID Teknisi di checked_by
            const sqlUpdateHist = `
                UPDATE histories 
                SET status_PMC = ?, tanggal_cek = NOW(), action_type = 'Update', checked_by = ? 
                WHERE device_id = ? AND tahun = ?
            `;
            
            db.query(sqlUpdateHist, [status_pmc, idTeknisi, id, tahun], (errUpdate) => {
                if(errUpdate) console.error("Update History Error:", errUpdate);
                res.redirect(`/laptop/detail/${id}`);
            });
        } else {
            // B. INSERT HISTORY BARU: Masukkan ID Teknisi di checked_by
            const sqlInsertHist = `
                INSERT INTO histories (device_id, tahun, status_PMC, tanggal_cek, action_type, checked_by) 
                VALUES (?, ?, ?, NOW(), 'Update', ?)
            `;
            
            db.query(sqlInsertHist, [id, tahun, status_pmc, idTeknisi], (errInsert) => {
                if(errInsert) console.error("Insert History Error:", errInsert);
                res.redirect(`/laptop/detail/${id}`);
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
      if (err || results.length === 0) return res.redirect('/laptop');

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
              res.redirect('/laptop');
          });
      });
  });
});

module.exports = router;
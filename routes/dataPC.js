const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 1. DAFTAR DATA PC
router.get('/', (req, res) => {
  const bulanAktif = req.query.bulan || 'Januari';
  const keyword = req.query.keyword || ''; 

  const sql = `
    SELECT device_id, no, model, serial_number
    FROM devices
    WHERE device_type = 'PC'
    AND jadwal_PMC LIKE ?
    AND (model LIKE ? OR serial_number LIKE ?)
  `;

  db.query(sql, [`%${bulanAktif}%`, `%${keyword}%`, `%${keyword}%`], (err, results) => {
    if (err) return res.status(500).send('Query error');
    res.render('pages/dataPC', {
      title: 'Data PC',
      active: 'pc',
      css: 'dataDevice.css',
      pcs: results,
      bulanAktif,
      keyword 
    });
  });
});

// 2. DETAIL DATA PC
router.get('/detail/:id', (req, res) => {
  const id = req.params.id;
  const sql = `
    SELECT 
      d.device_id AS id, d.model, d.employee_no, d.serial_number AS serial, 
      d.checked_out, d.site, d.hostname, d.lokasi, d.jadwal_pmc, 
      IFNULL(h.status_pmc, 'Pending') AS status_pmc,
      u.fullname AS pemeriksa -- Ambil nama asli dari JOIN
    FROM devices d
    LEFT JOIN histories h ON d.device_id = h.device_id
    LEFT JOIN users u ON h.checked_by = u.user_id
    WHERE d.device_id = ?
    ORDER BY h.riwayat_id DESC LIMIT 1
  `;

  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).send("Database Error: " + err.message);
    res.render('pages/detailPC', {
      title: 'Detail Perangkat',
      active: 'pc',
      css: 'detail.css',
      pmc: results[0] 
    });
  });
});

// HALAMAN FORM EDIT PC
router.get('/detail/edit/:id', (req, res) => {
  const id = req.params.id;
  // Kita ambil data perangkat sekaligus status PMC terakhirnya
  const sql = `
    SELECT 
      d.device_id AS id, d.model, d.employee_no, d.serial_number AS serial, 
      d.checked_out, d.site, d.hostname AS hostname_sp, d.lokasi, d.jadwal_pmc,
      IFNULL(h.status_pmc, 'Pending') AS pmc_status
    FROM devices d
    LEFT JOIN histories h ON d.device_id = h.device_id
    WHERE d.device_id = ?
    ORDER BY h.riwayat_id DESC LIMIT 1
  `;

  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).send(err.message);
    if (results.length === 0) return res.status(404).send("Data tidak ditemukan");

    res.render('pages/editPC', {
      title: 'Edit Perangkat',
      active: 'pc',
      css: 'edit.css',
      device: results[0]
    });
  });
});

// 3. UPDATE DATA PC (PENGGUNAAN ID USER)
router.post('/detail/update/:id', (req, res) => {
  const deviceId = req.params.id;
  const idTeknisi = req.session.user.id; // AMBIL ID, BUKAN NAMA
  
  const { model, serial, site, lokasi, employee_no, checked_out, hostname_sp, jadwal_pmc, pmc_status } = req.body;

  const sqlUpdateDevice = `UPDATE devices SET model=?, serial_number=?, site=?, lokasi=?, employee_no=?, checked_out=?, hostname=?, jadwal_pmc=? WHERE device_id=?`;
  
  db.query(sqlUpdateDevice, [model, serial, site, lokasi, employee_no, checked_out, hostname_sp, jadwal_pmc, deviceId], (err) => {
    if (err) return res.status(500).send(err.message);

    const sqlCheck = `SELECT riwayat_id FROM histories WHERE device_id = ? AND tahun = YEAR(NOW()) LIMIT 1`;
    db.query(sqlCheck, [deviceId], (err, rows) => {
      if (rows.length > 0) {
        // UPDATE: Kirim idTeknisi (Angka)
        const sqlUpdateH = `UPDATE histories SET status_pmc=?, checked_by=?, tanggal_cek=NOW() WHERE riwayat_id=?`;
        db.query(sqlUpdateH, [pmc_status, idTeknisi, rows[0].riwayat_id], (err) => {
          if (err) return res.status(500).send(err.message);
          res.redirect(`/pc/detail/${deviceId}`);
        });
      } else {
        // INSERT: Kirim idTeknisi (Angka)
        const sqlInsertH = `INSERT INTO histories (device_id, status_pmc, checked_by, tanggal_cek, tahun) VALUES (?, ?, ?, NOW(), YEAR(NOW()))`;
        db.query(sqlInsertH, [deviceId, pmc_status, idTeknisi], (err) => {
          if (err) return res.status(500).send(err.message);
          res.redirect(`/pc/detail/${deviceId}`);
        });
      }
    });
  });
});

// 4. TAMBAH DATA PC

router.get('/tambah', (req, res) => {
  res.render('pages/tambahDataPC', { 
    title: 'Tambah Perangkat Baru',
    active: 'pc',
    css: 'edit.css' 
  });
});

router.post('/tambah', (req, res) => {
  const { no, device_type, model, serial, site, lokasi, employee_no, checked_out, hostname_sp, jadwal_pmc, pmc_status } = req.body;
  const idTeknisi = req.session.user.id; // AMBIL ID

  const sqlDevice = `INSERT INTO devices (no, device_type, model, serial_number, site, lokasi, employee_no, checked_out, hostname, jadwal_pmc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.query(sqlDevice, [no, device_type, model, serial, site, lokasi, employee_no, checked_out, hostname_sp, jadwal_pmc], (err, result) => {
    if (err) return res.status(500).send(err.message);
    const newDeviceId = result.insertId;

    const sqlHistory = `INSERT INTO histories (device_id, status_pmc, checked_by, tanggal_cek, tahun) VALUES (?, ?, ?, NOW(), YEAR(NOW()))`;
    db.query(sqlHistory, [newDeviceId, pmc_status, idTeknisi], (err) => {
      if (err) return res.status(500).send(err.message);
      res.redirect('/pc');
    });
  });
});

router.post('/detail/delete/:id', (req, res) => {
    const id = req.params.id;
    
    // Hapus history dulu karena ada foreign key, baru hapus device-nya
    db.query('DELETE FROM histories WHERE device_id = ?', [id], (err) => {
        if (err) return res.status(500).send(err.message);
        
        db.query('DELETE FROM devices WHERE device_id = ?', [id], (err) => {
            if (err) return res.status(500).send(err.message);
            res.redirect('/pc');
        });
    });
});

module.exports = router;
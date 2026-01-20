const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const riwayat = [
    { laptop_model: 'Probook 440 G10', aksi: 'Ditambahkan', dilakukan_oleh: 'Admin', tanggal: '10 Jan 2025, 09:15' },
    { laptop_model: 'Probook 440 G10', aksi: 'Diupdate', dilakukan_oleh: 'Admin', tanggal: '12 Jan 2025, 14:40' },
    { laptop_model: 'Probook 440 G10', aksi: 'Ditambahkan', dilakukan_oleh: 'Admin', tanggal: '18 Jan 2025, 09:00' }
  ];

  res.render('pages/riwayat', {
    title: 'Riwayat PMC',
    active: 'riwayat',
    layout: 'layouts/main',
    css: 'riwayat.css',
    riwayat
  });
});

module.exports = router;
const express = require('express');
const router = express.Router();

router.get('/laptop', (req, res) => {
  res.render('pages/laporan/laptop', {
    title: 'Laporan Laptop',
    active: 'laporan',
    subActive: 'laptop',
    layout: 'layouts/main',
    css: 'laporan.css'
  });
});

router.get('/pc', (req, res) => {
  res.render('pages/laporan/pc', {
    title: 'Laporan PC',
    active: 'laporan',
    subActive: 'pc',
    layout: 'layouts/main',
    css: 'laporan.css'
  });
});

module.exports = router;

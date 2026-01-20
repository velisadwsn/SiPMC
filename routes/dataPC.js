const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('pages/dataPC', {
    title: 'Data PC',
    active: 'pc',
    layout: 'layouts/main',
    css: 'dataDevice.css'
  });
});

/* ================= DETAIL ================= */
router.get('/detail', (req, res) => {
  const pmc = {
    id: 1,
    model: 'Optiplex SFF 7020',
    employee_no: '6644',
    serial: '7PD8P54',
    checked_out: 'DANI DARMA PUTRA',
    site: 'RO Padang',
    hostname: 'SPUNMRELIPS0307',
    lokasi: 'Bagonjong - Adm',
    jadwal_pmc: 'Januari 2026',
    status_pmc: 'Done'
  };

  res.render('pages/detailPC', {
    title: 'Detail Perangkat',
    active: 'pc',
    layout: 'layouts/main',
    css: 'detail.css',
    pmc
  });
});

/* ================= EDIT ================= */
router.get('/detail/edit/:id', (req, res) => {
  const device = {
    id: req.params.id,
    model: 'Optiplex SFF 7020',
    serial: '7PD8P54',
    site: 'RO Padang',
    lokasi: 'Bagonjong - Adm',
    employee_no: '6644',
    checked_out: 'DANI DARMA PUTRA',
    hostname_sp: 'SPUNMRELIPS0307',
    pmc_status: 'Done'
  };

  res.render('pages/editPC', {
    title: 'Edit Perangkat',
    active: 'pc',
    layout: 'layouts/main',
    css: 'edit.css',
    device
  });
});

/* ================= UPDATE ================= */
router.post('/detail/update/:id', (req, res) => {
  console.log('DATA UPDATE:', req.body);
});
/* ================= DELETE ================= */
router.post('/detail/delete/:id', (req, res) => {
  const id = req.params.id;
  console.log('Perangkat dihapus dengan ID:', id);

  // TODO: hapus perangkat dari database di sini

  res.redirect('/pc'); // kembali ke halaman list PMC
});
module.exports = router;

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('pages/dataLaptop', {
    title: 'Data Laptop',
    active: 'laptop',
    layout: 'layouts/main',
    css: 'dataDevice.css'
  });
});

/* ================= DETAIL ================= */
router.get('/detail', (req, res) => {
  const pmc = {
    id: 1,
    model: 'Probook 440 G10',
    employee_no: '3185',
    serial: '5CD40339N2',
    checked_out: 'ANDI PUTRA',
    cocd: '2000',
    hostname: '31852000NBS0024',
    lokasi: 'Region Padang',
    jadwal_pmc: 'Januari 2026',
    status_pmc: 'Done'
  };

  res.render('pages/detailLaptop', {
    title: 'Detail Perangkat',
    active: 'laptop',
    layout: 'layouts/main',
    css: 'detail.css',
    pmc
  });
});


/* ================= EDIT ================= */
router.get('/detail/edit/:id', (req, res) => {
  const device = {
    id: req.params.id,
    model: 'Probook 440 G10',
    serial: '5CD40339N2',
    cocd: '2000',
    lokasi: 'Region Padang',
    employee_no: '3185',
    checked_out: 'ANDI PUTRA',
    hostname_sp: '31852000NBS0024',
    pmc_status: 'Done'
  };

  res.render('pages/editLaptop', {
    title: 'Edit Perangkat',
    active: 'laptop',
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

  res.redirect('/laptop'); // kembali ke halaman list PMC
});
module.exports = router;

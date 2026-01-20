const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('pages/dashboard', {
    title: 'Dashboard',
    active: 'dashboard',
    layout: 'layouts/main',
    css: 'dashboard.css'
  });
});


module.exports = router;

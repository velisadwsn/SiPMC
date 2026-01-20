const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('pages/login', { 
    title: 'Login',
    css: 'login.css'
  });
});

router.post('/', (req, res) => {
  // sementara langsung redirect
  res.redirect('/dashboard');
});

module.exports = router;

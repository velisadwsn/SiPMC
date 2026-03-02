const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcrypt');

// Halaman Login
router.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('pages/login', { title: 'Login', css: 'login.css', layout: false });
});

// Proses Login
router.post('/', (req, res) => {
  const { username, password } = req.body;

  db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
    if (err) return res.status(500).send("Database Error");
    
    if (results.length > 0) {
      const user = results[0];
      const match = await bcrypt.compare(password, user.password); 
      
      if (match) {
        req.session.user = {
          id: user.user_id,
          nama: user.fullname,
          unit: user.unit || 'ICT Unit',
          avatar: user.avatar || '/images/avatar/Pinterest.jpg'
        };
        return res.redirect('/dashboard');
      }
    }
    res.send("<script>alert('Username atau Password Salah!'); window.location='/';</script>");
  });
});


router.get('/buat-admin', async (req, res) => {
  const hash = await bcrypt.hash('admin123', 10); 
  db.query("INSERT INTO users (username, password, fullname, unit) VALUES (?, ?, ?, ?)", 
  ['admin', hash, 'Admin Satu', 'ICT Unit'], (err) => {
    if (err) return res.send(err.message);
    res.send("User Admin Berhasil Dibuat! Silakan login dengan pass: admin123");
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
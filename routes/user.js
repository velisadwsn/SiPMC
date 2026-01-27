const express = require('express');
const router = express.Router();
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.fieldname === 'avatar' ? './public/images/avatar' : './public/images/ttd';
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// HALAMAN PROFIL
router.get('/', (req, res) => {
  const userId = req.session.user.id;
  db.query('SELECT * FROM users WHERE user_id = ?', [userId], (err, results) => {
    if (err || results.length === 0) return res.redirect('/');
    res.render('pages/user', {
      title: 'Profil User',
      active: 'user',
      css: 'user.css',
      profile: results[0] 
    });
  });
});



router.post('/update', upload.single('ttd'), (req, res) => {
  const { nama, unit } = req.body;
  const userId = req.session.user.id;
  const ttdBaru = req.file ? req.file.filename : null;

  if (ttdBaru) {
    // A. JIKA ADA TTD BARU: Hapus yang lama dulu
    db.query('SELECT ttd FROM users WHERE user_id = ?', [userId], (err, results) => {
      const oldTTD = results[0].ttd;
      
      if (oldTTD) {
        const fullPath = path.join(__dirname, '../public/images/ttd/', oldTTD);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath); // Hapus file TTD lama
        }
      }

      // Update semua (Nama, Unit, TTD)
      db.query('UPDATE users SET fullname = ?, unit = ?, ttd = ? WHERE user_id = ?', [nama, unit, ttdBaru, userId], (err) => {
        if (err) return res.status(500).send(err.message);
        updateSessionAndRedirect(req, res, nama, unit);
      });
    });
  } else {
    // B. JIKA TIDAK ADA TTD BARU: Update Nama & Unit saja
    db.query('UPDATE users SET fullname = ?, unit = ? WHERE user_id = ?', [nama, unit, userId], (err) => {
      if (err) return res.status(500).send(err.message);
      updateSessionAndRedirect(req, res, nama, unit);
    });
  }
});

function updateSessionAndRedirect(req, res, nama, unit) {
  req.session.user.nama = nama;
  req.session.user.unit = unit;
  res.redirect('/user');
}


router.post('/avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) return res.redirect('/user');
  
  const userId = req.session.user.id;
  const newAvatarPath = '/images/avatar/' + req.file.filename;


  db.query('SELECT avatar FROM users WHERE user_id = ?', [userId], (err, results) => {
    if (err) return res.status(500).send(err.message);
    
    const oldAvatarPath = results[0].avatar;

   
    if (oldAvatarPath && oldAvatarPath !== '/images/avatar/default.jpg' && oldAvatarPath !== '/images/avatar/Pinterest.jpg') {
      const fullPath = path.join(__dirname, '../public', oldAvatarPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath); 
      }
    }

   
    db.query('UPDATE users SET avatar = ? WHERE user_id = ?', [newAvatarPath, userId], (err) => {
      if (err) return res.status(500).send(err.message);
      req.session.user.avatar = newAvatarPath;
      res.redirect('/user');
    });
  });
});
module.exports = router;
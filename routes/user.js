const express = require('express');
const router = express.Router();
const multer = require('multer');

const storage = multer.diskStorage({
  destination: './public/images/ttd',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

router.post('/', upload.single('ttd'), (req, res) => {
  const { nama, jabatan, username } = req.body;
  const ttd = req.file.filename;

  // simpan ke database
  // INSERT INTO users ...

  res.redirect('/user');
});


router.get('/', (req, res) => {
  res.render('pages/user', {
    title: 'Profil User',
    active: '',
    css: 'user.css'
  });
});

module.exports = router;


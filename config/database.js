const mysql = require('mysql2'); // Hapus '/promise'

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'sipmc',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Tes koneksi untuk memastikan MySQL nyala & user/pass benar
db.getConnection((err, connection) => {
  if (err) {
    console.error('Koneksi Database GAGAL:', err.message);
  } else {
    console.log('Database Berhasil Terhubung!');
    connection.release();
  }
});

module.exports = db;
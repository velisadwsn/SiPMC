const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
    // FIX: Tambahkan 'd.jadwal_PMC' di SELECT & LEFT JOIN
    const sql = `
        SELECT 
            h.*,            
            d.model,
            d.serial_number,
            d.no,
            d.jadwal_PMC
        FROM histories h
        LEFT JOIN devices d ON h.device_id = d.device_id
        ORDER BY h.tanggal_cek DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database Error');
        }

        res.render('pages/riwayat', {
            title: 'Riwayat Aktivitas',
            layout: 'layouts/main',
            active: 'riwayat', 
            css: 'riwayat.css', 
            histories: results
        });
    });
});

module.exports = router;
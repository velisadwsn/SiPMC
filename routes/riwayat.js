const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
    // Menangkap filter dari query string (contoh: /riwayat?type=Harian)
    const { type = '' } = req.query;
    
    // Dasar query SQL
    let sql = `
        SELECT 
            h.riwayat_id, h.device_id, h.pmc_type, h.status_PMC, 
            h.action_type, h.tanggal_cek, h.info_backup,
            d.model, d.serial_number, d.device_type
        FROM histories h
        LEFT JOIN devices d ON h.device_id = d.device_id
    `;

    const queryParams = [];
    // Jika filter dipilih, tambahkan kondisi WHERE
    if (type !== '') {
        sql += ` WHERE h.pmc_type = ?`;
        queryParams.push(type);
    }

    sql += ` ORDER BY h.tanggal_cek DESC`;

    db.query(sql, queryParams, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database Error');
        }

        res.render('pages/riwayat', {
            title: 'Riwayat Aktivitas',
            layout: 'layouts/main',
            active: 'riwayat', 
            css: 'riwayat.css', 
            histories: results,
            filterAktif: type // Dikirim agar dropdown tetap pada pilihan yang dipilih
        });
    });
});

module.exports = router;
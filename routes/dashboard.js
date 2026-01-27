const express = require('express');
const router = express.Router();
const db = require('../config/database');


router.get('/', (req, res) => {
    
    // 1. AMBIL BULAN SEKARANG
    const date = new Date();
    const listBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    const currentMonth = listBulan[date.getMonth()]; 
    const currentYear = date.getFullYear();          

    console.log("--- DEBUG DASHBOARD ---");
    console.log("Mencari data yang mengandung kata:", currentMonth);

    // 2. QUERY DATABASE (PAKAI 'LIKE' AGAR LEBIH FLEKSIBEL)
    const sql = `
        SELECT 
            d.device_type,
            COALESCE(
                (SELECT status_PMC FROM histories h WHERE h.device_id = d.device_id ORDER BY h.riwayat_id DESC LIMIT 1),
                'Pending'
            ) as status_final
        FROM devices d
        WHERE d.jadwal_PMC LIKE ? 
    `;

    // Tambahkan tanda persen (%) di kiri kanan bulan

    db.query(sql, [`%${currentMonth}%`], (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).send('Database Error');
        }

        console.log("Data ditemukan:", results.length); 

        // 3. HITUNG STATISTIK
        let stats = {
            total: results.length,
            totalLaptop: 0, totalPC: 0,
            pending: 0, pendingLaptop: 0, pendingPC: 0,
            done: 0, doneLaptop: 0, donePC: 0
        };

        results.forEach(dev => {
            // Hitung Jenis Device
            if (dev.device_type === 'Laptop') stats.totalLaptop++;
            else stats.totalPC++; 

            // Hitung Status
            if (dev.status_final === 'Done') {
                stats.done++;
                if (dev.device_type === 'Laptop') stats.doneLaptop++;
                else stats.donePC++;
            } else {
                stats.pending++;
                if (dev.device_type === 'Laptop') stats.pendingLaptop++;
                else stats.pendingPC++;
            }
        });

        // 4. RENDER KE TAMPILAN
        res.render('pages/dashboard', { 
            title: 'Dashboard Utama',
            layout: 'layouts/main',
            active: 'dashboard', 
            stats: stats,
            currentMonth: currentMonth, 
            currentYear: currentYear,
            css: 'dashboard.css'
        });
    });
});

module.exports = router;
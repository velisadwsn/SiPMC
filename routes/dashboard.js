const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
    const date = new Date();
    const listBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    const currentMonth = listBulan[date.getMonth()]; 
    const currentMonthNumeric = date.getMonth() + 1; 
    const currentYear = date.getFullYear();

    // 1. QUERY TAHUNAN (Tetap per bulan pengerjaan)
    const sqlTahunan = `
        SELECT d.device_type, 
               COALESCE((SELECT status_PMC FROM histories h WHERE h.device_id = d.device_id AND h.tahun = ? ORDER BY h.riwayat_id DESC LIMIT 1), 'Pending') as status_final
        FROM devices d
        WHERE d.pmc_category = 'Tahunan' AND d.jadwal_PMC LIKE ? 
    `;

    // 2. QUERY PROGRESS HARIAN & BULANAN (Disesuaikan filter waktunya)
    const sqlProgres = `
        SELECT 
            pmc_category, 
            COUNT(*) as total_aset,
            CASE 
                WHEN pmc_category = 'Harian' THEN 
                    (SELECT COUNT(DISTINCT device_id) FROM histories h 
                     WHERE h.pmc_type = 'Harian' AND h.status_PMC = 'Done' 
                     AND DATE(h.tanggal_cek) = CURDATE())
                WHEN pmc_category = 'Bulanan' THEN 
                    (SELECT COUNT(DISTINCT device_id) FROM histories h 
                     WHERE h.pmc_type = 'Bulanan' AND h.status_PMC = 'Done' 
                     AND MONTH(h.tanggal_cek) = ? AND YEAR(h.tanggal_cek) = ?)
            END as total_done
        FROM devices 
        WHERE pmc_category IN ('Harian', 'Bulanan') 
        GROUP BY pmc_category
    `;

    db.query(sqlTahunan, [currentYear, `%${currentMonth}%`], (err, tahunanResults) => {
        if (err) return res.status(500).send('Database Error');

        db.query(sqlProgres, [currentMonthNumeric, currentYear], (err2, progresResults) => {
            if (err2) return res.status(500).send('Database Error');

            let stats = {
                total: tahunanResults.length, totalLaptop: 0, totalPC: 0,
                pending: 0, pendingLaptop: 0, pendingPC: 0,
                done: 0, doneLaptop: 0, donePC: 0,
                harian: { total: 0, done: 0, persen: 0 },
                bulanan: { total: 0, done: 0, persen: 0 }
            };

            tahunanResults.forEach(dev => {
                if (dev.device_type === 'Laptop') stats.totalLaptop++; else stats.totalPC++; 
                if (dev.status_final === 'Done') {
                    stats.done++;
                    if (dev.device_type === 'Laptop') stats.doneLaptop++; else stats.donePC++;
                } else {
                    stats.pending++;
                    if (dev.device_type === 'Laptop') stats.pendingLaptop++; else stats.pendingPC++;
                }
            });

            progresResults.forEach(row => {
                const cat = row.pmc_category.toLowerCase();
                if (stats[cat]) {
                    stats[cat].total = row.total_aset;
                    stats[cat].done = row.total_done || 0;
                    stats[cat].persen = row.total_aset > 0 ? (stats[cat].done / row.total_aset) * 100 : 0;
                }
            });

            res.render('pages/dashboard', { 
                title: 'Dashboard Utama', layout: 'layouts/main', active: 'dashboard', 
                stats, currentMonth, currentYear, css: 'dashboard.css'
            });
        });
    });
});

module.exports = router;
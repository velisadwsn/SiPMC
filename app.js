const express = require('express');
const app = express();
const expressLayouts = require('express-ejs-layouts');


const authRoutes = require('./routes/login');
app.use('/', authRoutes);

app.use(expressLayouts);
app.set('layout', 'layouts/main');

// set ejs
app.set('view engine', 'ejs');
app.set('views', './views');
// static folder
app.use(express.static('public'));
app.use((req, res, next) => {
  res.locals.user = {
    nama: 'Admin Satu',
    unit: 'ICT Unit',
    avatar: '/images/Pinterest.jpg'
  };
  next();
});

app.use((req, res, next) => {
  res.locals.active = '';
  res.locals.subActive = '';
  next();
});

const dashboardRoutes = require('./routes/dashboard');
const dataPCRoutes = require('./routes/dataPC');
const laporanRoutes = require('./routes/laporan');
const userRoutes = require('./routes/user');
const dataLaptopRoutes = require('./routes/dataLaptop');
const riwayatRoutes = require('./routes/riwayat');

app.use('/riwayat', riwayatRoutes);
app.use('/laptop', dataLaptopRoutes);
app.use('/user', userRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/pc', dataPCRoutes);
app.use('/laporan', laporanRoutes);

// server
app.listen(3000, () => {
  console.log('Server jalan di http://localhost:3000');
});


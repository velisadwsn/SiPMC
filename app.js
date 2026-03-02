const express = require('express');
const app = express();
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const db = require('./config/database');

// 1. MIDDLEWARE DASAR
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 2. CONFIG SESSION (Wajib sebelum Routes)
app.use(session({
  secret: 'sipmc_2026_key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // Aktif 24 jam
}));

// 3. VIEW ENGINE
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('view engine', 'ejs');
app.set('views', './views');

// 4. GLOBAL VARIABLES (Untuk Header/Avatar)
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.active = '';
  res.locals.subActive = '';
  next();
});

// 5. MIDDLEWARE PROTEKSI (Mencegah akses tanpa login)
const isAuth = (req, res, next) => {
  if (req.session.user) return next();
  res.redirect('/');
};

// 6. ROUTES
const authRoutes = require('./routes/login');
const dashboardRoutes = require('./routes/dashboard');
const dataPCRoutes = require('./routes/dataPC');
const dataLaptopRoutes = require('./routes/dataLaptop');
const riwayatRoutes = require('./routes/riwayat');
const laporanRoutes = require('./routes/laporan');
const userRoutes = require('./routes/user');
const harianRouter = require('./routes/harian');
const bulananRouter = require('./routes/bulanan');

app.use('/', authRoutes); // Halaman Login
app.use('/dashboard', isAuth, dashboardRoutes);
app.use('/pc', isAuth, dataPCRoutes);
app.use('/laptop', isAuth, dataLaptopRoutes);
app.use('/riwayat', isAuth, riwayatRoutes);
app.use('/laporan', isAuth, laporanRoutes);
app.use('/user', isAuth, userRoutes);
app.use('/harian', isAuth, harianRouter); // TAMBAHKAN isAuth
app.use('/bulanan', isAuth, bulananRouter); // TAMBAHKAN isAuth

app.listen(3000, () => {
  console.log('Server jalan di http://localhost:3000');
});
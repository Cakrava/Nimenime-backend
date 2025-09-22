// src/app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const animeRoutes = require('./routes/animeRoutes');
const systemRoutes = require('./routes/systemRoutes');
const jobRoutes = require('./routes/jobRoutes'); // Jika tetap ingin mempertahankan bot

// Import Middleware
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { protectOptional } = require('./middleware/authMiddleware'); // BARU: Middleware opsional untuk user_data di rute publik

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(morgan('dev'));

// Route dasar
app.get('/', (req, res) => {
    res.send('AnimeVerse Backend API is running!');
});

// BARU: Middleware opsional untuk semua rute yang mungkin memerlukan data pengguna
// Ini akan mencoba memverifikasi token dan melampirkan req.user jika ada,
// tetapi tidak akan menghentikan request jika token tidak valid atau tidak ada.
app.use('/api/v1', protectOptional);


// Definisi Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/anime', animeRoutes); // Semua rute anime di bawah /api/v1/anime
app.use('/api/v1/system', systemRoutes);
app.use('/api/v1/jobs', jobRoutes); //

// Penanganan 404
app.use(notFound);
// Penanganan error global
app.use(errorHandler);


module.exports = app;
// src/routes/animeRoutes.js
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
    validateAnimeReview,        // BARU
    validateReportBrokenLink,   // BARU
    validateAnimeSearchQuery    // BARU: Opsional untuk validasi query umum
} = require('../middleware/validationMiddleware'); // Import validation middleware BARU

const {
    getAnimeList,
    getAnimeFullDetail,
    getTopAnime,
    getSeasonNowAnime,
    getWeeklySchedules,
    getAnimeGenres,
    getAnimeRecommendations,
    getAnimeEpisodeDetail,
    getAllSeasons,
    getAnimeBySeason,
    addAnimeReview,
    getAnimeReviews,
    reportBrokenLink,
} = require('../controllers/animeController');
const router = express.Router();

// Endpoint publik dengan opsional user_data jika authenticated
router.get('/', validateAnimeSearchQuery, getAnimeList); // `protect` di sini sebagai opsional. Jika token ada, req.user akan diset.
router.get('/:id/full', getAnimeFullDetail); // Parameter id akan divalidasi di controller atau middleware
router.get('/:id/episodes', getAnimeEpisodeDetail);

router.get('/top/anime', getTopAnime);
router.get('/seasons', getAllSeasons);

router.get('/seasons/now', getSeasonNowAnime);
router.get('/seasons/:year/:season', getAnimeBySeason);

router.get('/schedules', getWeeklySchedules);
router.get('/genres/anime', getAnimeGenres);
router.get('/:id/recommendations', getAnimeRecommendations);

// BARU: Rute untuk Ulasan Anime
router.post('/:id/reviews', protect, validateAnimeReview, addAnimeReview);
router.get('/:id/reviews', getAnimeReviews);

// BARU: Rute untuk Pelaporan Link Rusak
router.post('/:id/episode/:episode_number/report', protect, validateReportBrokenLink, reportBrokenLink);


module.exports = router;
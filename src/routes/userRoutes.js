// src/routes/userRoutes.js
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { validateUserProfileUpdate, validateChangePassword, validateFavoriteAnimeId, validateWatchProgress } = require('../middleware/validationMiddleware'); // BARU: Import validation
const {
    getUserProfile,
    updateUserProfile, // BARU
    changePassword,    // BARU
    getUserFavorites,
    addAnimeToFavorites,
    removeAnimeFromFavorites,
    updateWatchProgress,
} = require('../controllers/userController');
const router = express.Router();

router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, validateUserProfileUpdate, updateUserProfile); // BARU: Rute update profil
router.put('/change-password', protect, validateChangePassword, changePassword); // BARU: Rute ganti password

router.get('/favorites', protect, getUserFavorites);
router.post('/favorites', protect, validateFavoriteAnimeId, addAnimeToFavorites);
router.delete('/favorites/:anime_id', protect, removeAnimeFromFavorites);
router.post('/progress', protect, validateWatchProgress, updateWatchProgress);

module.exports = router;
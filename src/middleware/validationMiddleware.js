// src/middleware/validationMiddleware.js
const { body, param, query, validationResult } = require('express-validator');

// Middleware untuk menangani hasil validasi
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// --- AUTH VALIDATION ---
const validateRegister = [
    body('username')
        .trim()
        .notEmpty().withMessage('Username is required.')
        .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long.')
        .isAlphanumeric().withMessage('Username can only contain letters and numbers.'),
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Invalid email format.'),
    body('password')
        .notEmpty().withMessage('Password is required.')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
    handleValidationErrors
];

const validateLogin = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Invalid email format.'),
    body('password')
        .notEmpty().withMessage('Password is required.'),
    handleValidationErrors
];

// --- USER PROFILE VALIDATION ---
const validateUserProfileUpdate = [
    body('username')
        .optional()
        .trim()
        .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long.')
        .isAlphanumeric().withMessage('Username can only contain letters and numbers.'),
    body('email')
        .optional()
        .trim()
        .isEmail().withMessage('Invalid email format.'),
    body('avatar')
        .optional()
        .isURL().withMessage('Avatar must be a valid URL.'),
    body('bio')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters.'),
    handleValidationErrors
];

const validateChangePassword = [
    body('currentPassword')
        .notEmpty().withMessage('Current password is required.'),
    body('newPassword')
        .notEmpty().withMessage('New password is required.')
        .isLength({ min: 6 }).withMessage('New password must be at least 6 characters long.'),
    handleValidationErrors
];

// --- ANIME RELATED VALIDATION ---
const validateFavoriteAnimeId = [
    body('anime_id')
        .notEmpty().withMessage('Anime ID is required.')
        .isInt({ min: 1 }).withMessage('Anime ID must be a positive integer.'),
    handleValidationErrors
];

const validateWatchProgress = [
    body('anime_id')
        .notEmpty().withMessage('Anime ID is required.')
        .isInt({ min: 1 }).withMessage('Anime ID must be a positive integer.'),
    body('watched_episodes')
        .notEmpty().withMessage('Watched episodes count is required.')
        .isInt({ min: 0 }).withMessage('Watched episodes must be a non-negative integer.'),
    body('status')
        .notEmpty().withMessage('Watch status is required.')
        .isIn(['watching', 'completed', 'planned', 'dropped', 'on_hold']).withMessage('Invalid watch status.'),
    handleValidationErrors
];

// BARU: Validasi untuk ulasan anime
const validateAnimeReview = [
    param('id')
        .notEmpty().withMessage('Anime ID is required in URL.')
        .isInt({ min: 1 }).withMessage('Anime ID must be a positive integer.'),
    body('rating')
        .notEmpty().withMessage('Rating is required.')
        .isInt({ min: 1, max: 10 }).withMessage('Rating must be an integer between 1 and 10.'),
    body('comment')
        .optional()
        .trim()
        .isLength({ max: 2000 }).withMessage('Comment cannot exceed 2000 characters.'),
    handleValidationErrors
];

// BARU: Validasi untuk laporan link rusak
const validateReportBrokenLink = [
    param('id')
        .notEmpty().withMessage('Anime MAL ID is required in URL.')
        .isInt({ min: 1 }).withMessage('Anime MAL ID must be a positive integer.'),
    param('episode_number')
        .notEmpty().withMessage('Episode number is required in URL.')
        .isInt({ min: 1 }).withMessage('Episode number must be a positive integer.'),
    body('source')
        .notEmpty().withMessage('Source of the broken link is required.')
        .trim()
        .isLength({ max: 50 }).withMessage('Source cannot exceed 50 characters.'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters.'),
    handleValidationErrors
];

// BARU: Validasi opsional untuk query pencarian anime (untuk mencegah parameter yang sangat aneh)
const validateAnimeSearchQuery = [
    query('q').optional().trim().isLength({ max: 100 }).withMessage('Search query too long.'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be an integer between 1 and 100.'),
    query('genres').optional().matches(/^(\d+,)*\d+$/).withMessage('Genres must be comma-separated integers.'),
    query('status').optional().isIn(['currently airing', 'finished airing', 'not yet aired', 'hiatus', 'cancelled', 'upcoming']).withMessage('Invalid status filter.'),
    query('rating').optional().isIn(['G', 'PG', 'PG-13', 'R - 17+', 'R+', 'Rx']).withMessage('Invalid rating filter.'),
    query('order_by').optional().isIn(['popularity', 'score', 'latest', 'title', 'rank', 'members']).withMessage('Invalid order_by parameter.'),
    query('sort').optional().isIn(['asc', 'desc']).withMessage('Sort parameter must be "asc" or "desc".'),
    query('min_score').optional().isFloat({ min: 0, max: 10 }).withMessage('Min score must be a float between 0 and 10.'),
    query('max_score').optional().isFloat({ min: 0, max: 10 }).withMessage('Max score must be a float between 0 and 10.'),
    query('min_members').optional().isInt({ min: 0 }).withMessage('Min members must be a non-negative integer.'),
    query('year').optional().isInt({ min: 1900, max: 2100 }).withMessage('Year must be a valid year.'),
    query('season').optional().isIn(['winter', 'spring', 'summer', 'fall']).withMessage('Invalid season.'),
    query('studio').optional().matches(/^(\d+,)*\d+$/).withMessage('Studio IDs must be comma-separated integers.'),
    query('producer').optional().matches(/^(\d+,)*\d+$/).withMessage('Producer IDs must be comma-separated integers.'),
    handleValidationErrors
];


module.exports = {
    validateRegister,
    validateLogin,
    validateUserProfileUpdate,
    validateChangePassword,
    validateFavoriteAnimeId,
    validateWatchProgress,
    validateAnimeReview,
    validateReportBrokenLink,
    validateAnimeSearchQuery,
    handleValidationErrors
};
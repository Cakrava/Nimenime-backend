const express = require('express');
const router = express.Router();
const { body } = require('express-validator'); // BARU: Untuk validasi
const { requestJob, submitStreamLinks } = require('../controllers/jobController');
const { handleValidationErrors } = require('../middleware/validationMiddleware'); // Import untuk penanganan error validasi

// TODO: Amankan endpoint ini dengan API Key rahasia untuk para bot (middleware khusus)
// Untuk saat ini, kita hanya melakukan validasi body dasar

router.post('/request', requestJob); // BotId ada di body request

router.post('/submit', [
    body('botId').notEmpty().withMessage('Bot ID is required.'),
    body('mal_id').notEmpty().isInt({ min: 1 }).withMessage('Valid MAL ID is required.'),
    body('episode_number').notEmpty().isInt({ min: 1 }).withMessage('Valid episode number is required.'),
    body('sources').isArray().withMessage('Sources must be an array.'),
    body('sources.*.server').notEmpty().withMessage('Server name is required for each source.'),
    body('sources.*.quality').notEmpty().withMessage('Quality is required for each source.'),
    body('sources.*.url').notEmpty().isURL().withMessage('Valid URL is required for each source.'),
    handleValidationErrors // Middleware untuk menangani error validasi
], submitStreamLinks);


module.exports = router;
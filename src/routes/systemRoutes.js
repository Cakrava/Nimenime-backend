const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware'); // Import middleware protect
const { // BARU: Tambahkan getBrokenLinkReports
    getSystemStats,
    manualMatch,
    triggerScraper,
    getFailedLinks,
    triggerEnrichment,
    syncAndCreateJobs,
    getBrokenLinkReports,
    deleteJobs,
    unassignJobs,
} = require('../controllers/systemController');

// TODO: Tambahkan middleware keamanan admin di sini juga jika diperlukan role-based access!
// Semua rute sistem ini harus DIAMANKAN!

router.get('/stats', protect, getSystemStats);
router.post('/match/:scrapedId/:malId', protect, manualMatch);
router.post('/rescraping', protect, triggerScraper);
router.get('/failed-links', protect, getFailedLinks);
router.post('/trigger-enrichment', protect, triggerEnrichment); // Ubah nama rute agar lebih jelas
router.post('/sync-jobs', protect, syncAndCreateJobs);
router.get('/broken-link-reports', protect, getBrokenLinkReports); // BARU: Rute untuk melihat laporan link rusak
router.post('/jobs/unassign', protect, unassignJobs); // Mengubah status pekerjaan menjadi 'pending'
router.delete('/jobs/delete', protect, deleteJobs);   // Menghapus pekerjaan

module.exports = router;
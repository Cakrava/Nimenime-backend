const ScrapedLink = require('../models/ScrapedLink');
const Anime = require('../models/Anime');
const JobTicket = require('../models/JobTicket');
const BrokenLinkReport = require('../models/BrokenLinkReport'); // BARU: Import model laporan link rusak
const { runScraper } = require('../services/scraperService');
const axios = require('axios');

const config = require('../config');
const { processQueue } = require('../services/enrichmentService');

// @desc    Get stats of the data pipeline
// @route   GET /api/v1/system/stats
// @access  Private/Admin (Harus diamankan!)
const unassignJobs = async (req, res) => {
    const { botId, statusToReset = 'assigned' } = req.body; // default reset assigned jobs

    let filter = {};
    if (botId) {
        filter = { assignedTo: botId, status: statusToReset };
    } else {
        // Jika tidak ada botId, reset semua yang dalam statusToReset
        filter = { status: statusToReset };
    }

    try {
        const updateResult = await JobTicket.updateMany(
            filter,
            { $set: { status: 'pending', assignedTo: null, assignedAt: null, expiresAt: null } }
        );

        if (updateResult.modifiedCount === 0) {
            return res.json({ message: `No jobs found with status '${statusToReset}' to unassign (Filter: ${JSON.stringify(filter)}).`, modifiedCount: 0 });
        }

        console.log(`[System] Successfully unassigned ${updateResult.modifiedCount} jobs. Filter used: ${JSON.stringify(filter)}`);
        res.json({
            message: `Successfully unassigned ${updateResult.modifiedCount} jobs. They are now 'pending'.`,
            modifiedCount: updateResult.modifiedCount
        });
    } catch (error) {
        console.error("Error unassigning jobs:", error);
        res.status(500).json({ message: "Error unassigning jobs", error: error.message });
    }
};


const getSystemStats = async (req, res) => {
    try {
        const totalLinks = await ScrapedLink.countDocuments();
        const processed = await ScrapedLink.countDocuments({ status: 'processed' });
        const pending = await ScrapedLink.countDocuments({ status: 'pending' });
        const failed = await ScrapedLink.countDocuments({ status: 'match_failed' });
        const totalAnimeInDB = await Anime.countDocuments();
        const totalBrokenLinkReports = await BrokenLinkReport.countDocuments({ status: 'pending' }); // BARU: Hitung laporan pending

        res.json({
            message: "System Data Stats",
            totalScrapedLinks: totalLinks,
            linksProcessed: processed,
            linksPending: pending,
            linksFailedMatch: failed,
            totalAnimeWithDetails: totalAnimeInDB,
            isEnrichmentComplete: pending === 0,
            pendingBrokenLinkReports: totalBrokenLinkReports, // BARU
        });
    } catch (error) {
        console.error("Error fetching system stats:", error);
        res.status(500).json({ message: "Error fetching stats", error: error.message });
    }
};

// @desc    Get a list of all scraped links that failed to match
// @route   GET /api/v1/system/failed-links
// @access  Private/Admin
const getFailedLinks = async (req, res) => {
    try {
        const failedLinks = await ScrapedLink.find({ status: 'match_failed' })
            .select('url text status createdAt')
            .sort({ createdAt: 1 });

        if (failedLinks.length === 0) {
            return res.json({
                message: "Great news! No failed links found.",
                count: 0,
                links: []
            });
        }

        res.json({
            message: `Found ${failedLinks.length} links that need manual matching.`,
            count: failedLinks.length,
            links: failedLinks,
        });
    } catch (error) {
        console.error("Error fetching failed links:", error);
        res.status(500).json({ message: "Error fetching failed links", error: error.message });
    }
};

// @desc    Manually trigger the enrichment service to process pending links
// @route   POST /api/v1/system/trigger-enrichment
// @access  Private/Admin
const triggerEnrichment = async (req, res) => {
    res.status(202).json({ message: "Enrichment service has been started in the background. Check server logs for progress." });

    console.log('Manual enrichment trigger activated. Processing pending links...');
    try {
        // Ini akan memanggil processQueue beberapa kali sampai tidak ada yang pending
        let pendingCount = await ScrapedLink.countDocuments({ status: 'pending' });
        console.log(`Found ${pendingCount} pending links to process.`);

        while (pendingCount > 0) {
            await processQueue();
            pendingCount = await ScrapedLink.countDocuments({ status: 'pending' }); // Cek ulang setiap iterasi
            console.log(`Remaining pending links: ${pendingCount}`);
        }
        console.log('Manual enrichment process complete.');
    } catch (error) {
        console.error("Manual enrichment run failed:", error);
    }
};

// @desc    Sync existing Animes with JobTickets
// @route   POST /api/v1/system/sync-jobs
// @access  Private/Admin
const syncAndCreateJobs = async (req, res) => {
    try {
        console.log('[SYNC] Starting sync between animes and jobtickets...');

        const allAnimeMalIds = await Anime.find({}).select('mal_id').lean();
        if (allAnimeMalIds.length === 0) {
            return res.json({ message: "No animes found in the database to sync." });
        }
        console.log(`[SYNC] Found ${allAnimeMalIds.length} animes in the main collection.`);

        const operations = allAnimeMalIds.map(anime => ({
            updateOne: {
                filter: { anime_mal_id: anime.mal_id },
                update: {
                    $setOnInsert: {
                        anime_mal_id: anime.mal_id,
                        status: 'pending'
                    }
                },
                upsert: true,
            },
        }));

        const result = await JobTicket.bulkWrite(operations);

        console.log(`[SYNC] Sync complete. Created ${result.upsertedCount} new job tickets.`);
        res.json({
            message: "Sync complete!",
            totalAnimesChecked: allAnimeMalIds.length,
            newJobsCreated: result.upsertedCount,
        });

    } catch (error) {
        console.error("Error during job sync:", error);
        res.status(500).json({ message: "Error during job sync", error: error.message });
    }
};

// @desc    Manually match a scraped link with a Jikan MAL ID
// @route   POST /api/v1/system/match/:scrapedId/:malId
// @access  Private/Admin
const manualMatch = async (req, res) => {
    const { scrapedId, malId } = req.params;

    try {
        const linkToProcess = await ScrapedLink.findById(scrapedId);
        if (!linkToProcess) {
            return res.status(404).json({ message: "Scraped link not found." });
        }

        console.log(`Manual match initiated for ScrapedLink ID: ${scrapedId} (${linkToProcess.url}) with MAL ID: ${malId}`);

        // Langkah 1: Ambil data lengkap dari Jikan
        const fullDetailResponse = await axios.get(`${config.jikanApiBaseUrl}/anime/${malId}/full`); // Gunakan config.jikanApiBaseUrl
        if (!fullDetailResponse.data.data) {
            return res.status(404).json({ message: "Anime not found on Jikan with that MAL ID." });
        }
        const jikanAnimeData = fullDetailResponse.data.data;

        // Langkah 2: Update atau buat entri Anime di database lokal
        await Anime.updateOne(
            { mal_id: malId },
            {
                $set: { ...jikanAnimeData, last_updated: new Date() }, // Pastikan last_updated diupdate
                $addToSet: { base_links: { url: linkToProcess.url, source: linkToProcess.source } }
            },
            { upsert: true }
        );
        console.log(`Anime MAL ID ${malId} (${jikanAnimeData.title}) updated/created in local DB.`);

        // Langkah 3: Update status ScrapedLink menjadi 'processed'
        linkToProcess.status = 'processed';
        await linkToProcess.save();
        console.log(`ScrapedLink ID ${scrapedId} status updated to 'processed'.`);

        // Langkah 4: Pastikan JobTicket terkait juga dibuat atau diupdate
        await JobTicket.updateOne(
            { anime_mal_id: malId },
            { $setOnInsert: { status: 'pending' } }, // Biasanya 'pending' untuk scraping stream link
            { upsert: true }
        );
        console.log(`JobTicket for MAL ID ${malId} ensured.`);


        res.json({
            message: "Manual match successful!",
            matchedTitle: jikanAnimeData.title,
            scrapedLinkStatus: 'processed' // Konfirmasi status baru
        });

    } catch (error) {
        console.error("Error during manual match:", error);
        res.status(500).json({ message: "Error during manual match", error: error.message });
    }
};

// @desc    Manually trigger the scraper service to run again
// @route   POST /api/v1/system/rescraping
// @access  Private/Admin
const triggerScraper = (req, res) => {
    res.status(202).json({ message: "Scraper job has been re-initiated. This will run in the background. Check server logs." });

    runScraper().catch(err => {
        console.error("Manual scraper run failed:", err);
    });
};

// BARU: @desc    Get all broken link reports (Admin function)
// BARU: @route   GET /api/v1/system/broken-link-reports
// BARU: @access  Private/Admin
const getBrokenLinkReports = async (req, res) => {
    try {
        const reports = await BrokenLinkReport.find({})
            .populate('user', 'username email') // Tampilkan info pengguna yang melaporkan
            .select('-__v')
            .sort({ createdAt: -1 });

        res.json({
            message: `Found ${reports.length} broken link reports.`,
            count: reports.length,
            reports,
        });
    } catch (error) {
        console.error("Error fetching broken link reports:", error);
        res.status(500).json({ message: "Error fetching broken link reports", error: error.message });
    }
};
const deleteJobs = async (req, res) => {
    const { botId, statusToDelete = ['completed', 'failed'] } = req.body; // default delete completed or failed

    let filter = {};
    if (botId) {
        filter.assignedTo = botId;
    }
    // Pastikan statusToDelete adalah array
    if (!Array.isArray(statusToDelete)) {
        filter.status = statusToDelete;
    } else if (statusToDelete.length > 0) {
        filter.status = { $in: statusToDelete };
    } else {
        return res.status(400).json({ message: "Please specify statusToDelete or use default." });
    }


    try {
        const deleteResult = await JobTicket.deleteMany(filter);

        if (deleteResult.deletedCount === 0) {
            return res.json({ message: `No jobs found with filter ${JSON.stringify(filter)} to delete.`, deletedCount: 0 });
        }

        console.log(`[System] Successfully deleted ${deleteResult.deletedCount} jobs. Filter used: ${JSON.stringify(filter)}`);
        res.json({
            message: `Successfully deleted ${deleteResult.deletedCount} jobs.`,
            deletedCount: deleteResult.deletedCount
        });
    } catch (error) {
        console.error("Error deleting jobs:", error);
        res.status(500).json({ message: "Error deleting jobs", error: error.message });
    }
};
module.exports = {
    getSystemStats,
    manualMatch,
    triggerScraper,
    getFailedLinks,
    triggerEnrichment,
    syncAndCreateJobs,
    getBrokenLinkReports, // BARU
    unassignJobs,
    deleteJobs
};
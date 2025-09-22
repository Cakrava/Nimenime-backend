const Anime = require('../models/Anime');
const JobTicket = require('../models/JobTicket');
const StreamLink = require('../models/StreamLink');
const { body, validationResult } = require('express-validator'); // BARU: Untuk validasi inline

// @desc    A bot requests a new job batch
// @route   POST /api/v1/jobs/request
// @access  Protected (Harus menggunakan API Key atau semacamnya)
const requestJob = async (req, res) => {
    const { botId } = req.body;
    const BATCH_SIZE = 10;

    // Validasi dasar
    if (!botId) {
        return res.status(400).json({ message: "Bot ID is required." });
    }

    try {
        console.log(`\n[Job Dispatcher] Receiving job request from bot: ${botId}`);

        const pendingJobs = await JobTicket.find({ status: 'pending' })
            .limit(BATCH_SIZE)
            .lean();

        if (pendingJobs.length === 0) {
            console.log('[Job Dispatcher] No pending jobs found. Sending empty response.');
            const totalJobs = await JobTicket.countDocuments();
            const assignedJobs = await JobTicket.countDocuments({ status: 'assigned' });
            const completedJobs = await JobTicket.countDocuments({ status: 'completed' });
            console.log(`[Job Dispatcher] Current DB status: Total=${totalJobs}, Assigned=${assignedJobs}, Completed=${completedJobs}`);
            return res.json({ message: "No new jobs available at the moment." });
        }

        const jobMalIds = pendingJobs.map(job => job.anime_mal_id);
        console.log(`[Job Dispatcher] Attempting to lock jobs for MAL IDs: ${jobMalIds.join(', ')}`);

        // "Lock" jobs by setting status to 'assigned'
        const updateResult = await JobTicket.updateMany(
            { anime_mal_id: { $in: jobMalIds }, status: 'pending' }, // Hanya update yang masih pending
            {
                $set: {
                    status: 'assigned',
                    assignedTo: botId,
                    assignedAt: new Date(),
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires in 24 hours
                }
            }
        );
        console.log(`[Job Dispatcher] updateMany result: ${updateResult.modifiedCount} documents modified.`);

        // Ambil kembali jobs yang benar-benar berhasil di-assign (penting untuk race conditions)
        const assignedAndLockedJobs = await JobTicket.find({
            anime_mal_id: { $in: jobMalIds },
            assignedTo: botId,
            status: 'assigned'
        }).lean();

        if (assignedAndLockedJobs.length === 0) {
            return res.json({ message: "No jobs could be assigned at this time (might be a race condition)." });
        }

        const actualAssignedMalIds = assignedAndLockedJobs.map(job => job.anime_mal_id);
        const animeDetails = await Anime.find({ mal_id: { $in: actualAssignedMalIds } }).select('mal_id title base_links').lean();

        console.log(`[Job Dispatcher] Dispatching ${animeDetails.length} jobs to bot ${botId}.`);
        res.json({
            message: `Assigned ${animeDetails.length} jobs to bot ${botId}.`,
            jobs: animeDetails,
        });

    } catch (error) {
        console.error("Error in requestJob:", error);
        res.status(500).json({ message: "Server error while dispatching job." });
    }
};

// @desc    A bot submits the results of its work
// @route   POST /api/v1/jobs/submit
// @access  Protected (Harus menggunakan API Key atau semacamnya)
const submitStreamLinks = async (req, res) => {
    // Validasi input di sini (atau gunakan validationMiddleware jika mau)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { botId, mal_id, episode_number, sources } = req.body;

    try {
        // Tampilkan di console nilai yang akan disimpan
        console.log(`[submitStreamLinks] Akan menyimpan stream links:`, {
            anime_mal_id: mal_id,
            episode_number: episode_number,
            sources: sources
        });

        await StreamLink.updateOne(
            { anime_mal_id: mal_id, episode_number: episode_number },
            { $set: { sources: sources } },
            { upsert: true }
        );

        // Tandai pekerjaan selesai
        const jobUpdateResult = await JobTicket.updateOne(
            { anime_mal_id: mal_id, assignedTo: botId, status: 'assigned' }, // Pastikan hanya bot yang di-assign yang bisa menyelesaikan
            { $set: { status: 'completed' } }
        );

        // Tampilkan di console hasil update job
        console.log(`[submitStreamLinks] JobTicket update result:`, jobUpdateResult);

        res.status(201).json({ message: `Successfully saved streams for MAL ID ${mal_id}, Episode ${episode_number}` });
    } catch (error) {
        console.error("Error saving stream links:", error);
        res.status(500).json({ message: "Error saving stream links", error: error.message });
    }
};

module.exports = {
    requestJob,
    submitStreamLinks,
};
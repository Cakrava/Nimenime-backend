// src/controllers/animeController.js
const Anime = require('../models/Anime');
const User = require('../models/User');
const StreamLink = require('../models/StreamLink');
const Review = require('../models/Review'); // BARU: Import model Review
const BrokenLinkReport = require('../models/BrokenLinkReport'); // BARU: Import model BrokenLinkReport
const { calculateAverageRating } = require('../services/reviewService'); // BARU: Import service ulasan

// Helper untuk menambahkan user_data ke objek anime
// OPTIMASI: Fungsi ini sekarang akan mengambil objek user, bukan ID,
// sehingga query user hanya dilakukan sekali di awal request jika user terautentikasi.
const enrichAnimeWithUserData = async (anime, user) => {
    if (!user || !anime) {
        return { ...anime.toObject ? anime.toObject() : anime, user_data: null };
    }

    const isFavorite = user.favorites.some(fav => fav.anime_id === anime.mal_id);
    const progress = user.watchProgress.find(p => p.anime_id === anime.mal_id);

    return {
        ...anime.toObject ? anime.toObject() : anime,
        user_data: {
            is_favorite: isFavorite,
            watched_episodes: progress ? progress.watched_episodes : 0,
            status: progress ? progress.status : 'planned',
        },
    };
};

// @desc    Search and list anime
// @route   GET /api/v1/anime
// @access  Public
const getAnimeList = async (req, res) => {
    const {
        q, page = 1, limit = 25, genres, status, rating, order_by, sort,
        min_score, max_score, min_members, year, season,
        studio, producer // BARU: Filter studio dan producer
    } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (q && q.trim() !== "") {
        // Langsung gunakan $text search. Jika index tidak ada, MongoDB akan
        // melempar error yang akan ditangkap oleh blok catch utama.
        query.$text = { $search: q.trim() };
    }
    if (genres) {
        const genreIds = genres.split(',').map(id => parseInt(id.trim(), 10));
        query['genres.mal_id'] = { $in: genreIds };
    }
    if (status) {
        const cleanedStatus = status.trim().toLowerCase();
        if (cleanedStatus === 'currently airing') {
            query.airing = true;
        } else if (cleanedStatus === 'finished airing') {
            query.airing = false;
            query.status = { $ne: 'Not yet aired' }; // Pastikan bukan yang belum tayang
        } else if (cleanedStatus === 'not yet aired') {
            query.status = new RegExp('not yet aired', 'i');
        } else {
            query.status = new RegExp(`^${cleanedStatus}$`, 'i');
        }
    }
    if (rating) query.rating = new RegExp(rating, 'i');

    // BARU: Filter min/max score
    if (min_score) query.score = { ...query.score, $gte: parseFloat(min_score) };
    if (max_score) query.score = { ...query.score, $lte: parseFloat(max_score) };

    // BARU: Filter min members
    if (min_members) query.members = { $gte: parseInt(min_members, 10) };

    // BARU: Filter year & season jika ada
    if (year) query.year = parseInt(year, 10);
    if (season) query.season = new RegExp(season, 'i');

    // BARU: Filter studio & producer
    if (studio) {
        const studioIds = studio.split(',').map(id => parseInt(id.trim(), 10));
        query['studios.mal_id'] = { $in: studioIds };
    }
    if (producer) {
        const producerIds = producer.split(',').map(id => parseInt(id.trim(), 10));
        query['producers.mal_id'] = { $in: producerIds };
    }


    let sortOptions = {};
    if (order_by) {
        if (order_by === 'latest') {
            sortOptions['aired.from'] = -1;
        } else if (order_by === 'score' || order_by === 'popularity' || order_by === 'members') {
            sortOptions[order_by] = sort === 'asc' ? 1 : -1;
        } else if (order_by === 'title') { // BARU: Urutkan berdasarkan judul
            sortOptions.title = sort === 'asc' ? 1 : -1;
        } else if (order_by === 'rank') { // BARU: Urutkan berdasarkan rank
            sortOptions.rank = sort === 'asc' ? 1 : -1;
        } else {
            sortOptions.popularity = -1; // Default fallback
        }
    } else {
        sortOptions.popularity = -1; // Default sort
    }

    try {
        const totalAnime = await Anime.countDocuments(query);
        const animeList = await Anime.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit, 10))
            .lean();

        // OPTIMASI: Ambil user sekali jika ada, lalu oper ke enrichAnimeWithUserData
        let user = null;
        if (req.user) {
            user = await User.findById(req.user._id).select('favorites watchProgress').lean();
        }

        const enrichedAnimeList = await Promise.all(
            animeList.map(anime => enrichAnimeWithUserData(anime, user)) // Oper objek user
        );

        res.json({
            pagination: {
                last_visible_page: Math.ceil(totalAnime / limit),
                has_next_page: (page * limit) < totalAnime,
                items: {
                    count: enrichedAnimeList.length,
                    total: totalAnime,
                    per_page: parseInt(limit, 10),
                },
            },
            data: enrichedAnimeList,
        });
    } catch (error) {
        console.error("Error in getAnimeList:", error);
        res.status(500).json({ message: "Server error fetching anime list." });
    }
};

// @desc    Get full anime details
// @route   GET /api/v1/anime/:id/full
// @access  Public
const getAnimeFullDetail = async (req, res) => {
    try {
        const anime_id = parseInt(req.params.id, 10);

        const [anime, streamLinks, reviews] = await Promise.all([
            Anime.findOne({ mal_id: anime_id }).lean(),
            StreamLink.find({ anime_mal_id: anime_id })
                .select('episode_number sources')
                .sort({ episode_number: 1 })
                .lean(),
            Review.find({ anime: anime_id }) // BARU: Ambil semua ulasan untuk anime ini
                .populate('user', 'username avatar level') // Tampilkan info pengguna yang mengulas
                .sort({ createdAt: -1 }) // Ulasan terbaru di atas
                .lean()
        ]);

        if (!anime) {
            return res.status(404).json({ message: 'Anime not found.' });
        }

        // OPTIMASI: Ambil user sekali jika ada
        let user = null;
        if (req.user) {
            user = await User.findById(req.user._id).select('favorites watchProgress').lean();
        }
        const enrichedAnime = await enrichAnimeWithUserData(anime, user);

        enrichedAnime.stream_links = streamLinks;
        enrichedAnime.reviews = reviews; // BARU: Tambahkan ulasan ke detail anime

        res.json({ data: enrichedAnime });

    } catch (error) {
        console.error("Error in getAnimeFullDetail:", error);
        res.status(500).json({ message: "Server error fetching anime details." });
    }
};


// @desc    Get top anime
// @route   GET /api/v1/top/anime
// @access  Public
const getTopAnime = async (req, res) => {
    const { filter = 'bypopularity', limit = 25, page = 1 } = req.query; // Tambah paginasi
    const skip = (page - 1) * limit;

    let query = {};
    let sortOptions = {};

    switch (filter) {
        case 'airing':
            query.airing = true;
            sortOptions.popularity = -1;
            break;
        case 'upcoming':
            query.status = 'Not yet aired';
            sortOptions.popularity = -1;
            break;
        case 'bypopularity':
            sortOptions.popularity = -1;
            break;
        case 'favorite': // Asumsi favorites field di Anime, atau bisa hitung dari user data
            sortOptions.favorites = -1;
            break;
        case 'score': // BARU: Top berdasarkan skor
            sortOptions.score = -1;
            break;
        case 'members': // BARU: Top berdasarkan members
            sortOptions.members = -1;
            break;
        default:
            sortOptions.popularity = -1;
    }

    try {
        const totalAnime = await Anime.countDocuments(query);
        const topAnimes = await Anime.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit, 10))
            .lean();

        let user = null;
        if (req.user) {
            user = await User.findById(req.user._id).select('favorites watchProgress').lean();
        }

        const enrichedAnimeList = await Promise.all(
            topAnimes.map(anime => enrichAnimeWithUserData(anime, user))
        );

        res.json({
            pagination: {
                last_visible_page: Math.ceil(totalAnime / limit),
                has_next_page: (page * limit) < totalAnime,
                items: {
                    count: enrichedAnimeList.length,
                    total: totalAnime,
                    per_page: parseInt(limit, 10),
                },
            },
            data: enrichedAnimeList,
        });
    } catch (error) {
        console.error("Error in getTopAnime:", error);
        res.status(500).json({ message: "Server error fetching top anime." });
    }
};

// src/controllers/animeController.js

// ... (kode lainnya) ...

// @desc    Get current season anime
// @route   GET /api/v1/seasons/now
// @access  Public
const getSeasonNowAnime = async (req, res) => {
    const {
        limit = 25,
        page = 1,
        order_by = 'popularity', // DEFAULT: popularitas
        sort = 'desc',        // DEFAULT: descending
        status               // Juga bisa filter status (e.g., 'currently airing')
    } = req.query;
    const skip = (page - 1) * limit;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-11
    let season;
    if (currentMonth >= 0 && currentMonth <= 2) season = 'winter';
    else if (currentMonth >= 3 && currentMonth <= 5) season = 'spring';
    else if (currentMonth >= 6 && currentMonth <= 8) season = 'summer';
    else season = 'fall';

    let query = { season: new RegExp(season, 'i'), year: currentYear };

    // Tambahkan filter status jika ada
    if (status) {
        const cleanedStatus = status.trim().toLowerCase();
        if (cleanedStatus === 'currently airing') {
            query.airing = true;
        } else if (cleanedStatus === 'finished airing') {
            query.airing = false;
            query.status = { $ne: 'Not yet aired' };
        } else if (cleanedStatus === 'not yet aired') {
            query.status = new RegExp('not yet aired', 'i');
        } else {
            query.status = new RegExp(`^${cleanedStatus}$`, 'i');
        }
    } else {
        // Default untuk musim saat ini mungkin hanya yang sedang tayang
        query.airing = true;
    }

    let sortOptions = {};
    if (order_by === 'latest') {
        sortOptions['aired.from'] = -1;
    } else if (order_by === 'score' || order_by === 'popularity' || order_by === 'members') {
        sortOptions[order_by] = sort === 'asc' ? 1 : -1;
    } else if (order_by === 'title') {
        sortOptions.title = sort === 'asc' ? 1 : -1;
    } else if (order_by === 'rank') {
        sortOptions.rank = sort === 'asc' ? 1 : -1;
    } else {
        sortOptions.popularity = -1; // Default fallback
    }

    try {
        const totalAnime = await Anime.countDocuments(query);
        const seasonAnimes = await Anime.find(query)
            .sort(sortOptions) // Gunakan sortOptions yang baru
            .skip(skip)
            .limit(parseInt(limit, 10))
            .lean();

        let user = null;
        if (req.user) {
            user = await User.findById(req.user._id).select('favorites watchProgress').lean();
        }

        const enrichedAnimeList = await Promise.all(
            seasonAnimes.map(anime => enrichAnimeWithUserData(anime, user))
        );

        res.json({
            pagination: {
                last_visible_page: Math.ceil(totalAnime / limit),
                has_next_page: (page * limit) < totalAnime,
                items: {
                    count: enrichedAnimeList.length,
                    total: totalAnime,
                    per_page: parseInt(limit, 10),
                },
            },
            data: enrichedAnimeList,
        });
    } catch (error) {
        console.error("Error in getSeasonNowAnime:", error);
        res.status(500).json({ message: "Server error fetching current season anime." });
    }
};



const getAllSeasons = async (req, res) => {
    try {
        const seasons = await Anime.aggregate([
            { $match: { season: { $exists: true, $ne: null, $ne: '' }, year: { $exists: true, $ne: null } } },
            {
                $group: {
                    _id: { year: "$year", season: "$season" },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    year: "$_id.year",
                    season: "$_id.season",
                    count: 1
                }
            },
            { $sort: { year: -1, season: 1 } }
        ]);

        res.json({ data: seasons });
    } catch (error) {
        console.error("Error in getAllSeasons:", error);
        res.status(500).json({ message: "Server error fetching seasons." });
    }
};

// @desc    Get anime by specific season and year
// @route   GET /api/v1/seasons/{year}/{season}
// @access  Public
const getAnimeBySeason = async (req, res) => {
    const { year, season } = req.params;
    const { page = 1, limit = 25, status, genres, min_score, max_score, min_members } = req.query; // Tambah filter lanjutan
    const skip = (page - 1) * limit;

    let query = {
        year: parseInt(year, 10),
        season: new RegExp(season, 'i')
    };

    if (status) {
        const cleanedStatus = status.trim().toLowerCase();
        if (cleanedStatus === 'currently airing') {
            query.airing = true;
        } else if (cleanedStatus === 'finished airing') {
            query.airing = false;
            query.status = { $ne: 'Not yet aired' };
        } else if (cleanedStatus === 'not yet aired') {
            query.status = new RegExp('not yet aired', 'i');
        } else {
            query.status = new RegExp(`^${cleanedStatus}$`, 'i');
        }
    } else {
        query.airing = true;
    }

    if (genres) {
        const genreIds = genres.split(',').map(id => parseInt(id.trim(), 10));
        query['genres.mal_id'] = { $in: genreIds };
    }

    // BARU: Filter min/max score
    if (min_score) query.score = { ...query.score, $gte: parseFloat(min_score) };
    if (max_score) query.score = { ...query.score, $lte: parseFloat(max_score) };

    // BARU: Filter min members
    if (min_members) query.members = { $gte: parseInt(min_members, 10) };

    try {
        const totalAnime = await Anime.countDocuments(query);
        const animeList = await Anime.find(query)
            .sort({ popularity: -1, score: -1 })
            .skip(skip)
            .limit(parseInt(limit, 10))
            .lean();

        let user = null;
        if (req.user) {
            user = await User.findById(req.user._id).select('favorites watchProgress').lean();
        }

        const enrichedAnimeList = await Promise.all(
            animeList.map(anime => enrichAnimeWithUserData(anime, user))
        );

        res.json({
            pagination: {
                last_visible_page: Math.ceil(totalAnime / limit),
                has_next_page: (page * limit) < totalAnime,
                items: {
                    count: enrichedAnimeList.length,
                    total: totalAnime,
                    per_page: parseInt(limit, 10),
                },
            },
            data: enrichedAnimeList,
        });

    } catch (error) {
        console.error(`Error in getAnimeBySeason for ${year} ${season}:`, error);
        res.status(500).json({ message: "Server error fetching anime for season." });
    }
};


// @desc    Get weekly schedules
// @route   GET /api/v1/schedules
// @access  Public
const getWeeklySchedules = async (req, res) => {
    const { filter, status = 'Currently Airing', page = 1, limit = 25 } = req.query; // Tambah paginasi
    const skip = (page - 1) * limit;

    let query = {};

    if (filter) {
        query['broadcast.day'] = new RegExp(filter, 'i');
    }

    const cleanedStatus = status.trim().toLowerCase();

    if (cleanedStatus === 'currently airing') {
        query.airing = true;
    } else if (cleanedStatus === 'finished airing') {
        query.airing = false;
    } else if (cleanedStatus === 'not yet aired') {
        query.status = new RegExp('not yet aired', 'i');
    } else {
        query.status = new RegExp(`^${cleanedStatus}$`, 'i');
    }

    try {
        const totalAnime = await Anime.countDocuments(query);
        const scheduledAnimes = await Anime.find(query)
            .sort({ 'broadcast.time': 1 })
            .skip(skip)
            .limit(parseInt(limit, 10))
            .lean();

        let user = null;
        if (req.user) {
            user = await User.findById(req.user._id).select('favorites watchProgress').lean();
        }

        const enrichedAnimeList = await Promise.all(
            scheduledAnimes.map(anime => enrichAnimeWithUserData(anime, user))
        );

        res.json({
            pagination: {
                last_visible_page: Math.ceil(totalAnime / limit),
                has_next_page: (page * limit) < totalAnime,
                items: {
                    count: enrichedAnimeList.length,
                    total: totalAnime,
                    per_page: parseInt(limit, 10),
                },
            },
            data: enrichedAnimeList,
        });
    } catch (error) {
        console.error("Error in getWeeklySchedules:", error);
        res.status(500).json({ message: "Server error fetching weekly schedules." });
    }
};

// @desc    Get anime genres
// @route   GET /api/v1/genres/anime
// @access  Public
const getAnimeGenres = async (req, res) => {
    try {
        const genres = await Anime.aggregate([
            { $unwind: "$genres" },
            {
                $group: {
                    _id: "$genres.mal_id",
                    name: { $first: "$genres.name" }
                }
            },
            {
                $project: {
                    _id: 0,
                    mal_id: "$_id",
                    name: 1
                }
            },
            { $sort: { name: 1 } }
        ]);
        res.json({ data: genres });
    } catch (error) {
        console.error("Error in getAnimeGenres:", error);
        res.status(500).json({ message: "Server error fetching anime genres." });
    }
};


// @desc    Get episode detail for a specific anime
// @route   GET /api/v1/anime/:id/episode
// @access  Public
const getAnimeEpisodeDetail = async (req, res) => {
    try {
        const anime_id = parseInt(req.params.id, 10);

        const anime = await Anime.findOne({ mal_id: anime_id })
            .select('episodes title')
            .lean();

        if (!anime) {
            return res.status(404).json({ message: 'Anime not found.' });
        }

        const streamLinks = await StreamLink.find({ anime_mal_id: anime_id })
            .select('episode_number sources')
            .sort({ episode_number: 1 })
            .lean();

        const episodesList = [];
        const totalEpisodes = anime.episodes || 0;

        for (let i = 1; i <= totalEpisodes; i++) {
            const streamInfo = streamLinks.find(sl => sl.episode_number === i);

            episodesList.push({
                episode_number: i,
                title: `${anime.title} Episode ${i}`,
                has_stream_links: streamInfo ? true : false,
                stream_sources: streamInfo ? streamInfo.sources : [],
            });
        }

        if (totalEpisodes === 0 && streamLinks.length > 0) {
            streamLinks.forEach(stream => {
                if (!episodesList.some(ep => ep.episode_number === stream.episode_number)) {
                    episodesList.push({
                        episode_number: stream.episode_number,
                        title: `${anime.title} Episode ${stream.episode_number}`,
                        has_stream_links: true,
                        stream_sources: stream.sources,
                    });
                }
            });
            episodesList.sort((a, b) => a.episode_number - b.episode_number);
        }

        res.json({
            anime_title: anime.title,
            total_episodes: totalEpisodes > 0 ? totalEpisodes : episodesList.length,
            data: episodesList,
        });

    } catch (error) {
        console.error("Error in getAnimeEpisodes:", error);
        res.status(500).json({ message: "Server error fetching episode details." });
    }
};

// @desc    Get anime recommendations (bisa dari Jikan atau jika ada logic sendiri)
// @route   GET /api/v1/anime/:id/recommendations
// @access  Public
const getAnimeRecommendations = async (req, res) => {
    const anime_id = parseInt(req.params.id, 10);

    try {
        const targetAnime = await Anime.findOne({ mal_id: anime_id }).lean();
        if (!targetAnime || !targetAnime.genres || targetAnime.genres.length === 0) {
            return res.status(404).json({ message: 'Anime or its genres not found for recommendations.' });
        }

        const genreIds = targetAnime.genres.map(g => g.mal_id);

        const recommendations = await Anime.find({
            'genres.mal_id': { $in: genreIds },
            mal_id: { $ne: anime_id }
        })
            .sort({ score: -1, popularity: -1 })
            .limit(10)
            .lean();

        let user = null;
        if (req.user) {
            user = await User.findById(req.user._id).select('favorites watchProgress').lean();
        }

        const enrichedRecommendations = await Promise.all(
            recommendations.map(anime => enrichAnimeWithUserData(anime, user))
        );

        res.json({ data: enrichedRecommendations });
    } catch (error) {
        console.error("Error in getAnimeRecommendations:", error);
        res.status(500).json({ message: "Server error fetching recommendations." });
    }
};

// BARU: @desc    Add a review for an anime
// BARU: @route   POST /api/v1/anime/:id/reviews
// BARU: @access  Private
const addAnimeReview = async (req, res) => {
    const anime_id = parseInt(req.params.id, 10);
    const { rating, comment } = req.body; // Sudah divalidasi oleh validationMiddleware

    try {
        const anime = await Anime.findOne({ mal_id: anime_id });
        if (!anime) {
            return res.status(404).json({ message: 'Anime not found.' });
        }

        // Cek apakah user sudah pernah review anime ini
        const existingReview = await Review.findOne({ user: req.user._id, anime: anime_id });
        if (existingReview) {
            return res.status(400).json({ message: 'You have already reviewed this anime. Please update your existing review.' });
        }

        const newReview = await Review.create({
            user: req.user._id,
            anime: anime_id,
            rating,
            comment,
        });

        // Update average rating dan reviewsCount di model Anime
        await calculateAverageRating(anime_id);

        res.status(201).json({ message: 'Review added successfully!', data: newReview });
    } catch (error) {
        console.error("Error adding anime review:", error);
        res.status(500).json({ message: "Server error adding review", error: error.message });
    }
};

// BARU: @desc    Get reviews for a specific anime
// BARU: @route   GET /api/v1/anime/:id/reviews
// BARU: @access  Public
const getAnimeReviews = async (req, res) => {
    const anime_id = parseInt(req.params.id, 10);
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    try {
        const totalReviews = await Review.countDocuments({ anime: anime_id });
        const reviews = await Review.find({ anime: anime_id })
            .populate('user', 'username avatar level')
            .skip(skip)
            .limit(parseInt(limit, 10))
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            pagination: {
                last_visible_page: Math.ceil(totalReviews / limit),
                has_next_page: (page * limit) < totalReviews,
                items: {
                    count: reviews.length,
                    total: totalReviews,
                    per_page: parseInt(limit, 10),
                },
            },
            data: reviews,
        });
    } catch (error) {
        console.error("Error fetching anime reviews:", error);
        res.status(500).json({ message: "Server error fetching reviews", error: error.message });
    }
};

// BARU: @desc    Report a broken stream link for an anime episode
// BARU: @route   POST /api/v1/anime/:id/episode/:episode_number/report
// BARU: @access  Private
const reportBrokenLink = async (req, res) => {
    const anime_id = parseInt(req.params.id, 10);
    const episode_number = parseInt(req.params.episode_number, 10);
    const { source, description } = req.body; // Sudah divalidasi oleh validationMiddleware

    try {
        const anime = await Anime.findOne({ mal_id: anime_id });
        if (!anime) {
            return res.status(404).json({ message: 'Anime not found.' });
        }

        // Cek apakah ada laporan serupa yang masih pending dari user yang sama untuk link yang sama
        const existingReport = await BrokenLinkReport.findOne({
            user: req.user._id,
            anime: anime_id,
            episode_number,
            source,
            status: 'pending'
        });

        if (existingReport) {
            return res.status(400).json({ message: 'You have already reported this link, and it is still pending review.' });
        }

        const newReport = await BrokenLinkReport.create({
            user: req.user._id,
            anime: anime_id,
            episode_number,
            source,
            description,
        });

        res.status(201).json({ message: 'Broken link reported successfully! Thank you for your contribution.', data: newReport });
    } catch (error) {
        console.error("Error reporting broken link:", error);
        res.status(500).json({ message: "Server error reporting link", error: error.message });
    }
};




module.exports = {
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
    addAnimeReview,        // BARU
    getAnimeReviews,       // BARU
    reportBrokenLink,      // BARU
};
// src/controllers/userController.js
const User = require('../models/User');
const Anime = require('../models/Anime');
const { calculateXpAndLevel } = require('../utils/xpCalculator');

// @desc    Get user profile
// @route   GET /api/v1/user/profile
// @access  Private
const getUserProfile = async (req, res) => {
    // req.user datang dari middleware protect
    const user = await User.findById(req.user._id).select('-password');

    if (user) {
        res.json({
            id: user._id,
            name: user.username, // Mungkin tetap pakai username sebagai "name"
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            bio: user.bio, // BARU: Tambahkan bio
            level: user.level,
            xp: user.xp,
            xpForNextLevel: user.xpForNextLevel,
            animeWatched: user.animeWatched,
            episodesWatched: user.episodesWatched,
            joinDate: user.joinDate,
        });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// BARU: @desc    Update user profile (username, email, avatar, bio)
// BARU: @route   PUT /api/v1/user/profile
// BARU: @access  Private
const updateUserProfile = async (req, res) => {
    const { username, email, avatar, bio } = req.body; // Ambil field yang diizinkan untuk diupdate

    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Update hanya jika field diberikan dan berbeda
        if (username && username !== user.username) {
            const usernameExists = await User.findOne({ username });
            if (usernameExists && usernameExists._id.toString() !== user._id.toString()) {
                return res.status(400).json({ message: 'Username already taken.' });
            }
            user.username = username;
        }

        if (email && email !== user.email) {
            const emailExists = await User.findOne({ email });
            if (emailExists && emailExists._id.toString() !== user._id.toString()) {
                return res.status(400).json({ message: 'Email already registered.' });
            }
            user.email = email;
        }

        if (avatar) user.avatar = avatar;
        if (bio !== undefined) user.bio = bio; // Izinkan bio kosong

        await user.save();
        res.json({
            message: 'Profile updated successfully!',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                bio: user.bio,
            }
        });

    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ message: "Error updating profile", error: error.message });
    }
};

// BARU: @desc    Change user password
// BARU: @route   PUT /api/v1/user/change-password
// BARU: @access  Private
const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Please provide current and new password.' });
    }

    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Verifikasi password lama
        if (!(await user.matchPassword(currentPassword))) {
            return res.status(401).json({ message: 'Current password is incorrect.' });
        }

        // Set password baru (pre-save hook akan menghash-nya)
        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password updated successfully!' });

    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ message: "Error changing password", error: error.message });
    }
};


// @desc    Get user's favorite anime list
// @route   GET /api/v1/user/favorites
// @access  Private
const getUserFavorites = async (req, res) => {
    const { page = 1, limit = 25 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.user._id);

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    const favoriteAnimeIds = user.favorites.map(fav => fav.anime_id);
    const totalFavorites = favoriteAnimeIds.length;

    const favoriteAnimeData = await Anime.find({ mal_id: { $in: favoriteAnimeIds } })
        .skip(skip)
        .limit(limit)
        .lean();

    // OPTIMASI: Pindahkan query user ke luar loop jika diperlukan di tempat lain
    // Tapi untuk satu user, findById sudah efisien.
    const enrichedAnimeList = await Promise.all(
        favoriteAnimeData.map(async anime => ({
            ...anime,
            user_data: {
                is_favorite: true,
                watched_episodes: user.watchProgress.find(p => p.anime_id === anime.mal_id)?.watched_episodes || 0,
                status: user.watchProgress.find(p => p.anime_id === anime.mal_id)?.status || 'planned',
            },
        }))
    );

    res.json({
        pagination: {
            last_visible_page: Math.ceil(totalFavorites / limit),
            has_next_page: (page * limit) < totalFavorites,
            items: {
                count: enrichedAnimeList.length,
                total: totalFavorites,
                per_page: limit,
            },
        },
        data: enrichedAnimeList,
    });
};


// @desc    Add anime to user's favorites
// @route   POST /api/v1/user/favorites
// @access  Private
const addAnimeToFavorites = async (req, res) => {
    const { anime_id } = req.body;

    // Validasi input dilakukan oleh validationMiddleware.js sekarang
    // if (!anime_id) {
    //     return res.status(400).json({ message: 'anime_id is required.' });
    // }

    const user = await User.findById(req.user._id);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    const animeExists = await Anime.findOne({ mal_id: anime_id });
    if (!animeExists) {
        return res.status(404).json({ message: 'Anime not found in database cache.' });
    }

    const isFavorite = user.favorites.some(fav => fav.anime_id === anime_id);
    if (isFavorite) {
        return res.status(400).json({ status: 'error', message: 'Anime already in favorites.' });
    }

    user.favorites.push({ anime_id });
    await user.save();

    res.status(200).json({ status: 'success', message: 'Anime added to favorites.' });
};

// @desc    Remove anime from user's favorites
// @route   DELETE /api/v1/user/favorites/:anime_id
// @access  Private
const removeAnimeFromFavorites = async (req, res) => {
    const anime_id = parseInt(req.params.anime_id, 10);

    const user = await User.findById(req.user._id);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    const initialLength = user.favorites.length;
    user.favorites = user.favorites.filter(fav => fav.anime_id !== anime_id);

    if (user.favorites.length === initialLength) {
        return res.status(404).json({ status: 'error', message: 'Anime not found in favorites.' });
    }

    await user.save();

    res.status(200).json({ status: 'success', message: 'Anime removed from favorites.' });
};

// @desc    Update user's watch progress for an anime
// @route   POST /api/v1/user/progress
// @access  Private
const updateWatchProgress = async (req, res) => {
    const { anime_id, watched_episodes, status } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    const animeDetail = await Anime.findOne({ mal_id: anime_id });
    if (!animeDetail) {
        return res.status(404).json({ message: 'Anime not found in database cache.' });
    }

    if (animeDetail.episodes && watched_episodes > animeDetail.episodes) {
        return res.status(400).json({ message: `Watched episodes cannot exceed total episodes (${animeDetail.episodes}).` });
    }

    let progressEntry = user.watchProgress.find(p => p.anime_id === anime_id);
    let oldEpisodesWatched = 0;

    if (progressEntry) {
        oldEpisodesWatched = progressEntry.watched_episodes;
        progressEntry.watched_episodes = watched_episodes;
        progressEntry.status = status;
        progressEntry.updatedAt = Date.now();
    } else {
        user.watchProgress.push({ anime_id, watched_episodes, status });
        // Jika ini anime pertama kali ditonton, increment animeWatched
        if (watched_episodes > 0) {
            user.animeWatched = (user.watchProgress.filter(p => p.watched_episodes > 0)).length;
        }
    }

    const newEpisodesAdded = watched_episodes - oldEpisodesWatched;
    if (newEpisodesAdded > 0) {
        user.episodesWatched += newEpisodesAdded;
        user.xp += newEpisodesAdded * 10;
        calculateXpAndLevel(user);
    }

    if (status === 'completed') {
        // Filter untuk menghitung anime yang COMPLETED, bukan hanya yang memiliki progress
        user.animeWatched = (user.watchProgress.filter(p => p.status === 'completed')).length;
    } else if (oldEpisodesWatched === 0 && watched_episodes > 0 && progressEntry && progressEntry.status !== 'completed') {
        // Jika sebelumnya belum ditonton sama sekali dan sekarang mulai ditonton
        user.animeWatched = (user.watchProgress.filter(p => p.watched_episodes > 0)).length;
    }


    await user.save();

    res.status(200).json({ status: 'success', message: 'Progress updated.' });
};


module.exports = {
    getUserProfile,
    updateUserProfile, // BARU
    changePassword,    // BARU
    getUserFavorites,
    addAnimeToFavorites,
    removeAnimeFromFavorites,
    updateWatchProgress,
};
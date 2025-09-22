// src/services/reviewService.js
const Review = require('../models/Review');
const Anime = require('../models/Anime');

// Fungsi untuk menghitung ulang rata-rata rating sebuah anime
const calculateAverageRating = async (anime_id) => {
    try {
        const result = await Review.aggregate([
            { $match: { anime: anime_id } },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: "$rating" },
                    reviewsCount: { $sum: 1 }
                }
            }
        ]);

        const anime = await Anime.findOne({ mal_id: anime_id });
        if (anime) {
            if (result.length > 0) {
                anime.averageRating = parseFloat(result[0].averageRating.toFixed(2)); // Bulatkan 2 desimal
                anime.reviewsCount = result[0].reviewsCount;
            } else {
                anime.averageRating = 0;
                anime.reviewsCount = 0;
            }
            await anime.save();
            console.log(`Updated average rating for Anime MAL ID ${anime_id}: ${anime.averageRating} (${anime.reviewsCount} reviews)`);
        }
    } catch (error) {
        console.error(`Error calculating average rating for Anime MAL ID ${anime_id}:`, error);
    }
};

module.exports = {
    calculateAverageRating,
};
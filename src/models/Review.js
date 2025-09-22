// src/models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    anime: {
        type: Number, // MAL ID
        ref: 'Anime',
        required: true,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
    },
    comment: {
        type: String,
        trim: true,
        maxlength: 2000,
    },
}, { timestamps: true });

// Mencegah satu user memberikan multiple review untuk anime yang sama
reviewSchema.index({ user: 1, anime: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
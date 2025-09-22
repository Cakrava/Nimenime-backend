// src/models/BrokenLinkReport.js
const mongoose = require('mongoose');

const brokenLinkReportSchema = new mongoose.Schema({
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
    episode_number: {
        type: Number,
        required: true,
        min: 1,
    },
    source: {
        type: String,
        required: true, // e.g., 'Pucuk', 'Mega', 'AniLink'
        trim: true,
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    status: {
        type: String,
        enum: ['pending', 'resolved', 'duplicate', 'false_report'],
        default: 'pending',
    },
    resolvedBy: { // Admin user yang menyelesaikan laporan
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    resolvedAt: {
        type: Date,
    },
}, { timestamps: true });

// Index untuk mencari laporan pending atau untuk user/anime/episode tertentu
brokenLinkReportSchema.index({ anime: 1, episode_number: 1, source: 1, status: 1 });
brokenLinkReportSchema.index({ user: 1, anime: 1, episode_number: 1, source: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });

module.exports = mongoose.model('BrokenLinkReport', brokenLinkReportSchema);
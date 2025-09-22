const mongoose = require('mongoose');

const ScraperStateSchema = new mongoose.Schema({
    stateName: {
        type: String,
        default: 'main_scraper',
        unique: true,
    },
    lastScrapedPage: {
        type: Number,
        default: 0,
    },
    isComplete: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

module.exports = mongoose.model('ScraperState', ScraperStateSchema);
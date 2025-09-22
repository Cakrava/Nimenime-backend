const mongoose = require('mongoose');

const ScrapedLinkSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
        unique: true,
    },
    text: {
        type: String,
        required: true,
    },
    source: {
        type: String,
        default: 'samehadaku',
    },
    status: {
        type: String,
        enum: ['pending', 'processed', 'match_failed'],
        default: 'pending',
    },
}, { timestamps: true });

ScrapedLinkSchema.index({ status: 1 });

module.exports = mongoose.model('ScrapedLink', ScrapedLinkSchema);
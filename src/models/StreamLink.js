const mongoose = require('mongoose');

const StreamSourceSchema = new mongoose.Schema({
    server: { type: String, required: true }, // e.g., 'Pucuk', 'Mega'
    quality: { type: String, required: true }, // e.g., '480p', '720p'
    url: { type: String, required: true },
}, { _id: false });

const StreamLinkSchema = new mongoose.Schema({
    anime_mal_id: { type: Number, required: true },
    episode_number: { type: Number, required: true },
    sources: [StreamSourceSchema],
}, { timestamps: true });

// Index untuk pencarian super cepat
StreamLinkSchema.index({ anime_mal_id: 1, episode_number: 1 }, { unique: true });

module.exports = mongoose.model('StreamLink', StreamLinkSchema);
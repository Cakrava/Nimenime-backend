const mongoose = require('mongoose');

const JobTicketSchema = new mongoose.Schema({
    anime_mal_id: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'assigned', 'completed', 'failed'],
        default: 'pending',
    },
    last_scraped_episode: { type: Number, default: 0 },
    assignedTo: { type: String }, // ID unik dari bot yang mengerjakan
    assignedAt: { type: Date },
    expiresAt: { type: Date, index: { expires: '7d' } },
}, { timestamps: true });

JobTicketSchema.index({ status: 1, anime_mal_id: 1 }); // Index untuk pencarian cepat

module.exports = mongoose.model('JobTicket', JobTicketSchema);
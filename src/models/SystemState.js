// src/models/SystemState.js
const mongoose = require('mongoose');

const SystemStateSchema = new mongoose.Schema({
    _id: String, // Kita akan set manual ke 'jikanState'
    fetchedPages: {
        type: [Number],
        default: []
    }
});

module.exports = mongoose.model('SystemState', SystemStateSchema);
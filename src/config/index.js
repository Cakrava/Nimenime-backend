// src/config/index.js
require('dotenv').config();

module.exports = {
    port: process.env.PORT || 5000,
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/animeverse',
    jwtSecret: process.env.JWT_SECRET || 'supersecretjwtkey',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
    jikanApiBaseUrl: process.env.JIKAN_API_BASE_URL || 'https://api.jikan.moe/v4',
};
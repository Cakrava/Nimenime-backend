// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, config.jwtSecret);
            req.user = await User.findById(decoded.id).select('-password');
            if (!req.user) { // Pastikan user masih ada di DB
                return res.status(401).json({ message: 'Not authorized, user no longer exists.' });
            }
            next();
        } catch (error) {
            console.error('Auth token failed:', error.message); // Log detail error
            return res.status(401).json({ message: 'Not authorized, token failed or expired.' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token provided.' });
    }
};

// BARU: Middleware yang akan mencoba melampirkan user, tapi TIDAK akan menghentikan request jika gagal
const protectOptional = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, config.jwtSecret);
            req.user = await User.findById(decoded.id).select('-password');
        } catch (error) {
            console.warn('Optional auth failed (token invalid or expired), proceeding without user:', error.message);
            // Tetap lanjutkan tanpa melampirkan req.user
            req.user = null; // Pastikan req.user null jika ada token tapi tidak valid
        }
    } else {
        req.user = null; // Pastikan req.user null jika tidak ada token
    }
    next();
};

module.exports = { protect, protectOptional };
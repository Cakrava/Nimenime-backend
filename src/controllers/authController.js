// src/controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const config = require('../config');

const generateToken = (id) => {
    return jwt.sign({ id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
};

// @desc    Register new user
// @route   POST /api/v1/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { username, email, password } = req.body;

    // Validasi input dilakukan oleh validationMiddleware.js

    const userExists = await User.findOne({ email });
    if (userExists) {
        return res.status(400).json({ message: 'Email already registered.' });
    }

    // Cek juga username
    const usernameTaken = await User.findOne({ username });
    if (usernameTaken) {
        return res.status(400).json({ message: 'Username already taken.' });
    }

    const user = await User.create({
        username,
        email,
        password,
    });

    if (user) {
        res.status(201).json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
            },
            token: generateToken(user._id),
        });
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
};

// @desc    Authenticate user & get token
// @route   POST /api/v1/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    // Validasi input dilakukan oleh validationMiddleware.js

    const user = await User.findOne({ email });

    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials (email not found).' });
    }

    if (user && (await user.matchPassword(password))) {
        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
            },
            token: generateToken(user._id),
        });
    } else {
        res.status(401).json({ message: 'Invalid credentials (password incorrect).' });
    }
};

module.exports = { registerUser, loginUser };
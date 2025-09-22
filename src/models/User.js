// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    avatar: {
        type: String,
        default: 'https://i.imgur.com/your-default-avatar.png', // Contoh default avatar
    },
    bio: { // BARU: Field untuk bio pengguna
        type: String,
        trim: true,
        maxlength: 500,
        default: '',
    },
    level: {
        type: Number,
        default: 1,
    },
    xp: {
        type: Number,
        default: 0,
    },
    xpForNextLevel: {
        type: Number,
        default: 100, // XP awal untuk naik level 2
    },
    animeWatched: {
        type: Number,
        default: 0,
    },
    episodesWatched: {
        type: Number,
        default: 0,
    },
    joinDate: {
        type: Date,
        default: Date.now,
    },
    favorites: [
        {
            anime_id: {
                type: Number, // MAL ID
                ref: 'Anime',
            },
            addedAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    watchProgress: [
        {
            anime_id: {
                type: Number, // MAL ID
                ref: 'Anime',
            },
            watched_episodes: {
                type: Number,
                default: 0,
            },
            status: {
                type: String,
                enum: ['watching', 'completed', 'planned', 'dropped', 'on_hold'],
                default: 'planned',
            },
            updatedAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
}, { timestamps: true });

// Hash password sebelum menyimpan
userSchema.pre('save', async function (next) {
    if (this.isModified('password')) { // Periksa hanya jika password dimodifikasi
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

// Metode untuk membandingkan password
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
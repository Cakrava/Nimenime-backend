// src/models/Anime.js
const mongoose = require('mongoose');

const animeSchema = new mongoose.Schema({
    mal_id: {
        type: Number,
        required: true,
        unique: true,
    },
    base_links: [{ // Ubah jadi array untuk menampung banyak link di masa depan
        url: String,
        source: String,
    }],
    url: String,
    images: Object, // Sesuaikan dengan struktur Jikan
    trailer: Object,
    approved: Boolean,
    titles: Array,
    title: String,
    title_english: String,
    title_japanese: String,
    type: String,
    source: String,
    episodes: Number,
    status: String,
    airing: Boolean,
    aired: Object,
    duration: String,
    rating: String,
    score: Number,
    scored_by: Number,
    rank: Number,
    popularity: Number,
    members: Number,
    favorites: Number,
    synopsis: String,
    background: String,
    season: String,
    year: Number,
    broadcast: Object,
    producers: Array,
    licensors: Array,
    studios: Array,
    genres: Array,
    explicit_genres: Array,
    themes: Array,
    demographics: Array,
    relations: Array,
    theme: Object,
    external: Array,
    // Tambahkan field lain dari Jikan jika diperlukan
    last_updated: { // Untuk melacak kapan terakhir di-update dari Jikan
        type: Date,
        default: Date.now,
    },
    // BARU: Field untuk sistem rating dan ulasan
    averageRating: {
        type: Number,
        default: 0,
    },
    reviewsCount: {
        type: Number,
        default: 0,
    }
}, {
    timestamps: true,
    strict: false, // Memungkinkan Jikan API data yang fleksibel
});

// animeSchema.index({ mal_id: 1 }); // Index untuk pencarian cepat berdasarkan MAL ID
animeSchema.index({ title: 'text' }); // Index teks untuk pencarian judul
animeSchema.index({ 'genres.mal_id': 1 }); // Index untuk filter genre
animeSchema.index({ 'studios.mal_id': 1 }); // BARU: Index untuk filter studio
animeSchema.index({ 'producers.mal_id': 1 }); // BARU: Index untuk filter producer
animeSchema.index({ score: -1 }); // Index untuk pengurutan berdasarkan skor
animeSchema.index({ popularity: -1 }); // Index untuk pengurutan berdasarkan popularitas
animeSchema.index({ members: -1 }); // BARU: Index untuk pengurutan/filter berdasarkan jumlah members

module.exports = mongoose.model('Anime', animeSchema);
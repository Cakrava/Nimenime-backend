// src/config/db.js
const mongoose = require('mongoose');
const config = require('./index');

const connectDB = async () => {
    try {
        await mongoose.connect(config.mongodbUri, {
            // dbName: "dbNimenime", // tentuin DB target
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('MongoDB Connected...');

        mongoose.connection.on('error', err => {
            console.error('MongoDB Connection Error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB Disconnected. Attempting to reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB Reconnected!');
        });

    } catch (err) {
        console.error('Initial MongoDB Connection Failed:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
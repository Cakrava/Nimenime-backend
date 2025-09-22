// server.js
const app = require('./src/app');
const connectDB = require('./src/config/db');
const config = require('./src/config');
const { startScheduler } = require('./src/services/schedulerService');

// Connect Database
connectDB();

startScheduler();

// Port dari konfigurasi
const PORT = config.port;

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access API at: http://localhost:${PORT}/api/v1`);
    console.log(`Test UI at: http://localhost:5000/index.html (Jika menggunakan live server atau statik)`);
});
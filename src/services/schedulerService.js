const cron = require('node-cron');
const { runScraper } = require('./scraperService');
const { processQueue } = require('./enrichmentService');
// const { fetchAndStoreAnimeData } = require('./jikanPollingService'); // HAPUS INI

let isProcessorRunning = false;
// let isJikanPollingRunning = false; // HAPUS INI
let isScraperRunning = false;

function startScheduler() {
    console.log('Scheduler started.');

    // Jalankan scraper saat server pertama kali start, setelah jeda singkat
    setTimeout(async () => {
        if (!isScraperRunning) {
            isScraperRunning = true;
            console.log('Initial scraper run starting...');
            await runScraper().finally(() => { isScraperRunning = false; });
        }
    }, 5000);

    // Jadwalkan scraper untuk berjalan setiap 24 jam jam 2 pagi
    cron.schedule('0 2 * * *', async () => {
        if (!isScraperRunning) {
            isScraperRunning = true;
            console.log('Running daily scraper job...');
            await runScraper().finally(() => { isScraperRunning = false; });
        } else {
            console.log('Skipping scheduled scraper run: previous run still active.');
        }
    });
    console.log('Daily scraper scheduled for 02:00 UTC.');


    // Jalankan prosesor enrichment setiap 5 detik
    setInterval(async () => {
        if (isProcessorRunning) return;

        isProcessorRunning = true;
        await processQueue().finally(() => { isProcessorRunning = false; });
    }, 5000);
    console.log('Enrichment processor scheduled to run every 5 seconds.');
}

module.exports = { startScheduler };
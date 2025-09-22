// src/services/scraperService.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const ScrapedLink = require('../models/ScrapedLink');
const ScraperState = require('../models/ScraperState');
const Anime = require('../models/Anime'); // BARU: Import model Anime untuk cek base_links
const config = require('../config');

puppeteer.use(StealthPlugin());

const SOURCE_URL = 'https://v1.samehadaku.how/daftar-anime-2/'; // Bisa dipindahkan ke config
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const pageEvaluator = () => {
    try {
        const links = [...document.querySelectorAll('.animposx a')];
        if (!links || links.length === 0) return [];
        return links.map(a => ({
            url: a.href,
            text: a.textContent.trim().replace(/\s+/g, ' '),
        }));
    } catch (e) {
        console.error('Error in page evaluator:', e.message);
        return null;
    }
};

async function runScraper() {
    console.log('🧠 Starting The Immortal Scraper...');
    let browser;
    try {
        let state = await ScraperState.findOneAndUpdate(
            { stateName: 'main_scraper' }, { $setOnInsert: { isComplete: false, lastScrapedPage: 0 } }, { upsert: true, new: true }
        );

        if (state.isComplete) {
            console.log('✅ Previous run was complete. Resetting scraper to page 1 for a fresh run.');
            state.lastScrapedPage = 0;
            state.isComplete = false;
            await state.save();
        }
        let currentPage = state.lastScrapedPage + 1;
        console.log(`▶️ Resuming scrape from page ${currentPage}`);

        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ],
            // executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });

        let keepRunning = true;
        let retries = 0;
        const MAX_RETRIES = 3;

        while (keepRunning) {
            try {
                const urlToScrape = `${SOURCE_URL}page/${currentPage}/`;
                console.log(`Navigating to page: ${urlToScrape}`);
                await page.goto(urlToScrape, { waitUntil: 'domcontentloaded', timeout: 45000 });

                console.log('Waiting for content or "Not Found" message...');
                const listSelector = '.animposx';
                const emptySelector = 'h3.notfound';

                const elementFound = await Promise.race([
                    page.waitForSelector(listSelector, { timeout: 10000 }).then(() => listSelector),
                    page.waitForSelector(emptySelector, { timeout: 10000 }).then(() => emptySelector)
                ]).catch(() => null);

                if (elementFound === emptySelector) {
                    console.log(`⏹️ Page ${currentPage} is empty ("No results" h3.notfound found). This is the end of the list.`);
                    keepRunning = false;
                    await ScraperState.updateOne({ stateName: 'main_scraper' }, { isComplete: true, lastScrapedPage: currentPage });
                    console.log('🏁 Scraper job finished successfully.');
                    continue;
                } else if (elementFound !== listSelector) {
                    throw new Error(`Neither list selector nor empty selector found on page ${currentPage}.`);
                }

                const scrapedData = await page.evaluate(pageEvaluator);

                if (!Array.isArray(scrapedData)) {
                    throw new Error(`Page evaluator returned invalid data on page ${currentPage}.`);
                }

                if (scrapedData.length > 0) {
                    // --- LOGIKA BARU UNTUK MENCEGAH DUPLIKASI DAN MENGHINDARI SCRAPING ULANG ---
                    const newLinksToProcess = [];
                    const allScrapedUrls = scrapedData.map(link => link.url);

                    // Cari di ScrapedLink yang sudah ada
                    const existingScrapedLinks = await ScrapedLink.find({ url: { $in: allScrapedUrls } }).lean();
                    const existingScrapedUrlsMap = new Map(existingScrapedLinks.map(link => [link.url, link.status]));

                    // Cari di Anime.base_links
                    const existingAnimeLinks = await Anime.find({ 'base_links.url': { $in: allScrapedUrls } }).lean();
                    const existingAnimeUrlsSet = new Set();
                    existingAnimeLinks.forEach(anime => {
                        anime.base_links.forEach(baseLink => {
                            if (allScrapedUrls.includes(baseLink.url)) {
                                existingAnimeUrlsSet.add(baseLink.url);
                            }
                        });
                    });

                    for (const link of scrapedData) {
                        const scrapedLinkStatus = existingScrapedUrlsMap.get(link.url);
                        const isInAnimeBaseLinks = existingAnimeUrlsSet.has(link.url);

                        if (isInAnimeBaseLinks) {
                            // Link sudah ada di Anime, berarti sudah pernah diproses dan cocok
                            if (scrapedLinkStatus && scrapedLinkStatus !== 'processed') {
                                // Jika ada di ScrapedLink tapi statusnya bukan 'processed', update menjadi 'processed'
                                newLinksToProcess.push({
                                    updateOne: {
                                        filter: { url: link.url },
                                        update: { $set: { status: 'processed' } }
                                    }
                                });
                                console.log(`[Scraper] INFO: URL '${link.url}' found in Anime. Marking ScrapedLink as 'processed'.`);
                            } else {
                                // Jika sudah 'processed' di ScrapedLink atau tidak ada di ScrapedLink tapi ada di Anime,
                                // berarti sudah ditangani sepenuhnya. Abaikan.
                                console.log(`[Scraper] INFO: URL '${link.url}' already processed/in Anime. Skipping.`);
                            }
                        } else if (scrapedLinkStatus === 'processed') {
                            // Ini adalah kasus yang jarang terjadi: ada di ScrapedLink sebagai 'processed'
                            // tapi tidak ada di Anime.base_links. Mungkin ada inkonsistensi data.
                            // Untuk saat ini, kita anggap sudah "diurus" dan tidak perlu diproses lagi oleh scraper.
                            console.log(`[Scraper] WARN: URL '${link.url}' is 'processed' in ScrapedLink but not found in Anime. Skipping.`);
                        } else if (scrapedLinkStatus === 'match_failed') {
                            // Link sebelumnya gagal dicocokkan, beri kesempatan lagi dengan mengubah status menjadi 'pending'
                            newLinksToProcess.push({
                                updateOne: {
                                    filter: { url: link.url },
                                    update: { $set: { status: 'pending', text: link.text, source: 'samehadaku' } },
                                    upsert: true
                                }
                            });
                            console.log(`[Scraper] INFO: URL '${link.url}' previously failed. Re-adding to 'pending' queue.`);
                        } else if (!scrapedLinkStatus) {
                            // Link benar-benar baru, tambahkan ke pending
                            newLinksToProcess.push({
                                insertOne: {
                                    document: {
                                        url: link.url,
                                        text: link.text,
                                        source: 'samehadaku',
                                        status: 'pending'
                                    }
                                }
                            });
                            console.log(`[Scraper] INFO: New URL '${link.url}' added to 'pending' queue.`);
                        }
                    }
                    if (newLinksToProcess.length > 0) {
                        await ScrapedLink.bulkWrite(newLinksToProcess, { ordered: false });
                        console.log(`✅ Processed and updated ${newLinksToProcess.length} ScrapedLink entries for page ${currentPage}.`);
                    } else {
                        console.log(`No new or updated ScrapedLink entries needed for page ${currentPage}.`);
                    }
                    // --- AKHIR LOGIKA BARU ---

                    await ScraperState.updateOne({ stateName: 'main_scraper' }, { lastScrapedPage: currentPage });
                    retries = 0;
                } else {
                    console.log(`No new links found on page ${currentPage}.`);
                }

                currentPage++;
                console.log('Taking a short break (3 seconds)...');
                await sleep(3000);

            } catch (error) {
                console.error(`Error processing page ${currentPage}: ${error.message}`);
                await page.screenshot({ path: `fatal_error_page_${currentPage}_${Date.now()}.png`, fullPage: true });

                if (retries < MAX_RETRIES) {
                    retries++;
                    console.log(`🚨 Retriable error detected. Retrying page ${currentPage} (Attempt ${retries}/${MAX_RETRIES}). Waiting for 10 seconds...`);
                    await sleep(10000);
                } else {
                    console.error('Max retries reached for this page. Stopping scraper for current run.');
                    keepRunning = false;
                }
            }
        }
    } catch (error) {
        console.error(`A critical error occurred in the scraper wrapper:`, error.message);
    } finally {
        if (browser) {
            await browser.close();
            console.log('Browser closed.');
        }
        console.log('🏁 The Scraper job finished.');
    }
}

module.exports = { runScraper };
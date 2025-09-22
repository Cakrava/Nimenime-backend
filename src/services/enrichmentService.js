const axios = require('axios');
const stringSimilarity = require('string-similarity');
const ScrapedLink = require('../models/ScrapedLink');
const Anime = require('../models/Anime');
const JobTicket = require('../models/JobTicket');
const config = require('../config');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const JIKAN_API_DELAY = 1500; // Delay 1.5 detik per request Jikan

async function processQueue() {
    const linkToProcess = await ScrapedLink.findOne({ status: 'pending' });

    if (!linkToProcess) {
        return; // Tidak ada pekerjaan, keluar
    }

    console.log(`Processing link: ${linkToProcess.url}`);

    try {
        // --- BARU: Cek apakah URL sudah ada di Anime.base_links ---
        const existingAnimeWithLink = await Anime.findOne({
            'base_links.url': linkToProcess.url
        });

        if (existingAnimeWithLink) {
            console.log(`URL ${linkToProcess.url} already associated with Anime MAL ID ${existingAnimeWithLink.mal_id}. Skipping Jikan search.`);
            await ScrapedLink.findByIdAndUpdate(linkToProcess._id, { status: 'processed' });
            // Pastikan juga JobTicket terkait sudah ada atau dibuat untuk anime ini jika belum
            await JobTicket.updateOne(
                { anime_mal_id: existingAnimeWithLink.mal_id },
                { $setOnInsert: { status: 'pending' } },
                { upsert: true }
            );
            return; // Lewati proses Jikan API dan enrichment
        }
        // --- AKHIR DARI PENAMBAHAN BARU ---


        const query = linkToProcess.url.split('/anime/')[1].replace(/-/g, ' ').replace('/', '').trim();
        console.log(`Searching Jikan for: "${query}"`);
        const searchResponse = await axios.get(`${config.jikanApiBaseUrl}/anime?q=${encodeURIComponent(query)}&limit=5`);

        await sleep(JIKAN_API_DELAY); // Tunggu 1.5 detik sebelum request berikutnya

        if (!searchResponse.data.data || searchResponse.data.data.length === 0) {
            await ScrapedLink.findByIdAndUpdate(linkToProcess._id, { status: 'match_failed' });
            console.log(`Match failed for "${query}": No results from Jikan.`);
            return;
        }

        const titles = searchResponse.data.data.map(anime => anime.title);
        const bestMatch = stringSimilarity.findBestMatch(query, titles);

        if (bestMatch.bestMatch.rating < 0.4) {
            await ScrapedLink.findByIdAndUpdate(linkToProcess._id, { status: 'match_failed' });
            console.log(`Match failed for "${query}": Low similarity score (${bestMatch.bestMatch.rating}).`);
            return;
        }

        const matchedAnime = searchResponse.data.data[bestMatch.bestMatchIndex];
        const mal_id = matchedAnime.mal_id;

        console.log(`Found potential match on Jikan: "${matchedAnime.title}" (MAL ID: ${mal_id}). Fetching full details...`);
        const fullDetailResponse = await axios.get(`${config.jikanApiBaseUrl}/anime/${mal_id}/full`);

        await sleep(JIKAN_API_DELAY); // Tunggu lagi

        await Anime.updateOne(
            { mal_id: mal_id },
            {
                $set: { ...fullDetailResponse.data.data, last_updated: new Date() },
                $addToSet: {
                    base_links: { url: linkToProcess.url, source: linkToProcess.source }
                }
            },
            { upsert: true }
        );
        // Buat atau update JobTicket untuk anime ini
        await JobTicket.updateOne(
            { anime_mal_id: mal_id },
            { $setOnInsert: { status: 'pending' } },
            { upsert: true }
        );

        await ScrapedLink.findByIdAndUpdate(linkToProcess._id, { status: 'processed' });
        console.log(`Successfully processed "${query}" -> Matched with "${matchedAnime.title}" (MAL ID: ${mal_id})`);

    } catch (error) {
        console.error(`Error processing link ${linkToProcess.url}:`, error.message);
        if (error.response) {
            console.error('Jikan API Response Data:', error.response.data);
            console.error('Jikan API Status:', error.response.status);
        }
        await ScrapedLink.findByIdAndUpdate(linkToProcess._id, { status: 'match_failed' });
    }
}

module.exports = { processQueue };
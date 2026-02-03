const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { loadConfig } = require('../config/loader');

// Enable stealth plugin to bypass bot detection
puppeteer.use(StealthPlugin());

// Singleton browser instance
let browser = null;

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get or create browser instance
 */
async function getBrowser() {
    if (!browser || !browser.isConnected()) {
        console.log('[Fetcher] Launching browser...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080',
            ],
        });
    }
    return browser;
}

/**
 * Close browser instance
 */
async function closeBrowser() {
    if (browser) {
        console.log('[Fetcher] Closing browser...');
        try {
            await browser.close();
        } catch (e) {
            // Ignore close errors
        }
        browser = null;
    }
}

/**
 * Fetch URL using Puppeteer with stealth
 */
async function getYad2ResponsePuppeteer(url) {
    const config = loadConfig();
    const maxRetries = config.maxRetries || 3;

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let page = null;
        try {
            if (attempt > 1) {
                const backoffMs = 2000 * Math.pow(2, attempt - 1);
                console.log(`[Fetcher] Retry ${attempt}/${maxRetries}, waiting ${backoffMs}ms...`);
                await sleep(backoffMs);
            }

            const browser = await getBrowser();
            page = await browser.newPage();

            // Set realistic viewport
            await page.setViewport({ width: 1920, height: 1080 });

            // Set extra headers to appear more human
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
            });

            console.log(`[Fetcher] Navigating to page (attempt ${attempt})...`);

            // Navigate and wait for content to load
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 30000,
            });

            // Random delay to appear more human (2-5 seconds)
            const humanDelay = 2000 + Math.random() * 3000;
            console.log(`[Fetcher] Waiting ${Math.round(humanDelay)}ms...`);
            await sleep(humanDelay);

            // Scroll down a bit to trigger lazy loading
            await page.evaluate(() => {
                window.scrollBy(0, 500);
            });
            await sleep(1000);

            const html = await page.content();
            await page.close();

            console.log('[Fetcher] Page fetched successfully');
            return html;
        } catch (error) {
            lastError = error;
            console.error(`[Fetcher] Attempt ${attempt} failed:`, error.message);
            if (page) {
                try {
                    await page.close();
                } catch (e) {
                    // Ignore close errors
                }
            }
        }
    }

    throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}

/**
 * Legacy fetch implementation (fallback)
 */
async function fetchWithRetry(url, options = {}) {
    const config = loadConfig();
    const maxRetries = options.maxRetries || config.maxRetries;
    const delayMs = options.delayMs || config.requestDelayMs;

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 1) {
                const backoffMs = delayMs * Math.pow(2, attempt - 1);
                console.log(`[Fetcher] Retry ${attempt}/${maxRetries}, waiting ${backoffMs}ms...`);
                await sleep(backoffMs);
            }

            const requestOptions = {
                method: 'GET',
                redirect: 'follow',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
            };

            const response = await fetch(url, requestOptions);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.text();
        } catch (error) {
            lastError = error;
            console.error(`[Fetcher] Attempt ${attempt} failed:`, error.message);
        }
    }

    throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}

/**
 * Fetch Yad2 page HTML
 * Uses Puppeteer by default, can fall back to fetch with USE_PUPPETEER=false
 */
async function getYad2Response(url) {
    const usePuppeteer = process.env.USE_PUPPETEER !== 'false';

    if (usePuppeteer) {
        return getYad2ResponsePuppeteer(url);
    }
    return fetchWithRetry(url);
}

module.exports = {
    fetchWithRetry,
    getYad2Response,
    getYad2ResponsePuppeteer,
    closeBrowser,
    getBrowser,
    sleep,
};

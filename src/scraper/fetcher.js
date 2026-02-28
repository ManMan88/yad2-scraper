const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { loadConfig } = require('../config/loader');

// Enable stealth plugin to bypass bot detection
puppeteer.use(StealthPlugin());

// Browser instance and usage counter
let browser = null;
let browserUseCount = 0;
const MAX_BROWSER_USES = 8; // Restart browser every N scrapes (higher = more session history like a real user)

// Pool of realistic User-Agent strings across platforms (Windows/macOS/Linux)
// Each entry includes the platform for matching sec-ch-ua-platform header
const USER_AGENTS = [
    // Windows Chrome
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', platform: 'Windows' },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', platform: 'Windows' },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', platform: 'Windows' },
    // macOS Chrome
    { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', platform: 'macOS' },
    { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', platform: 'macOS' },
    { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', platform: 'macOS' },
    // Linux Chrome
    { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', platform: 'Linux' },
    { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', platform: 'Linux' },
    { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', platform: 'Linux' },
];

// Realistic viewport sizes (common desktop resolutions)
const VIEWPORTS = [
    { width: 1920, height: 1080 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1680, height: 1050 },
    { width: 2560, height: 1440 },
];

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get or create browser instance, rotating after MAX_BROWSER_USES
 */
async function getBrowser() {
    if (browser && browser.isConnected() && browserUseCount < MAX_BROWSER_USES) {
        return browser;
    }

    // Close old browser if it exists
    if (browser) {
        console.log(`[Fetcher] Recycling browser after ${browserUseCount} uses...`);
        try {
            await browser.close();
        } catch (e) {
            // Ignore close errors
        }
        browser = null;
    }

    const viewport = randomItem(VIEWPORTS);

    console.log('[Fetcher] Launching browser...');
    browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            `--window-size=${viewport.width},${viewport.height}`,
            // Reduce automation detection surface
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-infobars',
            '--lang=he-IL,he',
        ],
    });
    browserUseCount = 0;

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
        browserUseCount = 0;
    }
}

/**
 * Simulate realistic mouse movements on a page
 */
async function simulateHumanBehavior(page, viewport) {
    // Move mouse to a random position (as if looking around)
    const x1 = randomBetween(100, viewport.width - 100);
    const y1 = randomBetween(100, viewport.height - 100);
    await page.mouse.move(x1, y1, { steps: Math.floor(randomBetween(5, 15)) });
    await sleep(randomBetween(200, 600));

    // Scroll down in a few steps with variable amounts (like a human scanning listings)
    const scrollSteps = Math.floor(randomBetween(2, 5));
    for (let i = 0; i < scrollSteps; i++) {
        const scrollAmount = Math.floor(randomBetween(200, 600));
        await page.evaluate((amount) => {
            window.scrollBy({ top: amount, behavior: 'smooth' });
        }, scrollAmount);
        await sleep(randomBetween(400, 1200));

        // Occasionally move the mouse while scrolling
        if (Math.random() > 0.5) {
            const mx = randomBetween(200, viewport.width - 200);
            const my = randomBetween(100, viewport.height - 100);
            await page.mouse.move(mx, my, { steps: Math.floor(randomBetween(3, 10)) });
        }
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

                // On retry, force a fresh browser to get a clean fingerprint
                await closeBrowser();
            }

            const browserInstance = await getBrowser();
            page = await browserInstance.newPage();

            // Randomize viewport
            const viewport = randomItem(VIEWPORTS);
            await page.setViewport({
                width: viewport.width,
                height: viewport.height,
                deviceScaleFactor: Math.random() > 0.5 ? 2 : 1,
            });

            // Set a rotated User-Agent (with matching platform)
            const agentInfo = randomItem(USER_AGENTS);
            await page.setUserAgent(agentInfo.ua);

            // Build Client Hints headers that match the selected User-Agent
            const chromeMatch = agentInfo.ua.match(/Chrome\/([\d]+)/);
            const majorVersion = chromeMatch ? chromeMatch[1] : '131';

            await page.setExtraHTTPHeaders({
                'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'sec-ch-ua': `"Chromium";v="${majorVersion}", "Google Chrome";v="${majorVersion}", "Not-A.Brand";v="99"`,
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': `"${agentInfo.platform}"`,
            });

            // Note: navigator.webdriver, navigator.plugins, and navigator.languages
            // are all handled by puppeteer-extra-plugin-stealth — no manual overrides needed

            console.log(`[Fetcher] Navigating to page (attempt ${attempt})...`);

            // Navigate and wait for content to load
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 30000,
            });

            // Random delay to appear more human (3-7 seconds)
            const humanDelay = randomBetween(3000, 7000);
            console.log(`[Fetcher] Waiting ${Math.round(humanDelay)}ms...`);
            await sleep(humanDelay);

            // Simulate realistic human behavior
            await simulateHumanBehavior(page, viewport);
            await sleep(randomBetween(500, 1500));

            const html = await page.content();
            await page.close();
            browserUseCount++;

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
                    'User-Agent': randomItem(USER_AGENTS).ua,
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

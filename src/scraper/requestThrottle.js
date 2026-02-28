/**
 * Cross-process request throttle and shared captcha cooldown.
 *
 * All scraper processes coordinate through two files in the data directory:
 *   .last-request-ts   – timestamp of the most recent request to Yad2
 *   .captcha-cooldown   – JSON with {until, count} when captcha was detected
 *
 * This prevents multiple scrapers from hammering Yad2 simultaneously and
 * ensures ALL scrapers back off when any one of them triggers a captcha.
 */

const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../config/loader');

// Minimum gap between any two requests to Yad2 (across all scraper processes)
const MIN_REQUEST_GAP_MS = 2 * 60 * 1000; // 2 minutes

// Maximum captcha cooldown cap
const MAX_CAPTCHA_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

function getDataDir() {
    const config = loadConfig();
    const dir = config.dataDir;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

function getTimestampPath() {
    return path.join(getDataDir(), '.last-request-ts');
}

function getCooldownPath() {
    return path.join(getDataDir(), '.captcha-cooldown');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Read the last request timestamp from the shared file.
 * Returns 0 if the file doesn't exist or can't be read.
 */
function readLastRequestTs() {
    try {
        const content = fs.readFileSync(getTimestampPath(), 'utf8').trim();
        const ts = parseInt(content, 10);
        return isNaN(ts) ? 0 : ts;
    } catch {
        return 0;
    }
}

/**
 * Read the captcha cooldown state.
 * Returns { until: 0, count: 0 } if no cooldown is active.
 */
function readCaptchaCooldown() {
    try {
        const content = fs.readFileSync(getCooldownPath(), 'utf8');
        const data = JSON.parse(content);
        return {
            until: data.until || 0,
            count: data.count || 0,
        };
    } catch {
        return { until: 0, count: 0 };
    }
}

/**
 * Wait until the global request throttle and captcha cooldown allow a request.
 *
 * 1. Check captcha cooldown — if active, wait until it expires.
 * 2. Check last request timestamp — if too recent, wait for the gap.
 *
 * @param {number} intervalMs - The scraper's interval (used for logging)
 * @param {Function} logFn - Logging function (defaults to console.log)
 */
async function waitForThrottle(intervalMs, logFn = console.log) {
    // 1. Captcha cooldown check
    const cooldown = readCaptchaCooldown();
    if (cooldown.until > Date.now()) {
        const waitMs = cooldown.until - Date.now();
        const waitMin = (waitMs / 60000).toFixed(1);
        logFn(`[Throttle] Captcha cooldown active (attempt #${cooldown.count}), waiting ${waitMin} min...`);
        await sleep(waitMs);
    }

    // 2. Request gap throttle
    const lastTs = readLastRequestTs();
    const elapsed = Date.now() - lastTs;
    if (lastTs > 0 && elapsed < MIN_REQUEST_GAP_MS) {
        const waitMs = MIN_REQUEST_GAP_MS - elapsed;
        const waitSec = Math.round(waitMs / 1000);
        logFn(`[Throttle] Another scraper requested ${Math.round(elapsed / 1000)}s ago, waiting ${waitSec}s for gap...`);
        await sleep(waitMs);
    }
}

/**
 * Record that a request was just made. Call this right before fetching.
 */
function recordRequest() {
    try {
        fs.writeFileSync(getTimestampPath(), String(Date.now()));
    } catch (err) {
        // Non-fatal — worst case two scrapers overlap once
        console.error('[Throttle] Failed to write request timestamp:', err.message);
    }
}

/**
 * Signal that a captcha was detected. ALL scrapers will back off.
 *
 * Uses exponential backoff: intervalMs * 2^count, capped at MAX_CAPTCHA_COOLDOWN_MS.
 *
 * @param {number} intervalMs - Base interval to calculate cooldown from
 */
function signalCaptcha(intervalMs) {
    const existing = readCaptchaCooldown();
    const count = existing.count + 1;
    const cooldownMs = Math.min(intervalMs * Math.pow(2, count), MAX_CAPTCHA_COOLDOWN_MS);
    const until = Date.now() + cooldownMs;

    const data = { until, count, triggeredAt: new Date().toISOString() };
    try {
        fs.writeFileSync(getCooldownPath(), JSON.stringify(data));
        const cooldownMin = (cooldownMs / 60000).toFixed(1);
        console.log(`[Throttle] Captcha signaled (attempt #${count}), all scrapers cooling down for ${cooldownMin} min`);
    } catch (err) {
        console.error('[Throttle] Failed to write captcha cooldown:', err.message);
    }
}

/**
 * Clear the captcha cooldown after a successful scrape.
 * Only clears if the cooldown period has actually passed.
 */
function clearCaptchaCooldown() {
    const cooldown = readCaptchaCooldown();
    if (cooldown.count > 0 && cooldown.until <= Date.now()) {
        try {
            fs.unlinkSync(getCooldownPath());
        } catch {
            // File may have already been removed by another scraper
        }
    }
}

module.exports = {
    waitForThrottle,
    recordRequest,
    signalCaptcha,
    clearCaptchaCooldown,
    MIN_REQUEST_GAP_MS,
};

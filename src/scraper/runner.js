#!/usr/bin/env node

/**
 * Continuous scraper runner - runs a single topic in a loop
 * Meant to be spawned as a background process by the CLI
 */

const { Command } = require('commander');
const { scrapeByTopic } = require('./index');
const { getProject } = require('../config/loader');
const { closeBrowser } = require('./fetcher');
const { sendMessage } = require('./notifier');

const program = new Command();

program
    .option('--topic <topic>', 'Topic to scrape (required)')
    .option('--interval <minutes>', 'Interval between scrapes in minutes', '20')
    .parse();

const options = program.opts();

if (!options.topic) {
    console.error('[Runner] Error: --topic is required');
    process.exit(1);
}

const topic = options.topic;
const intervalMinutes = parseInt(options.interval, 10);
const intervalMs = intervalMinutes * 60 * 1000;
// Jitter: +/- 30% of interval to avoid all scrapers hitting at the same time
const JITTER_FACTOR = 0.3;

const QUIET_ALERT_MS = 6 * 60 * 60 * 1000; // 6 hours

// Verify topic exists
const project = getProject(topic);
if (!project) {
    console.error(`[Runner] Error: Topic "${topic}" not found in config`);
    process.exit(1);
}

if (project.disabled) {
    console.error(`[Runner] Error: Topic "${topic}" is disabled`);
    process.exit(1);
}

let scheduleTimeout = null;
let isShuttingDown = false;

// Track when we last saw new ads (initialized to now so the 6h timer starts from startup)
let lastNewAdTime = Date.now();

/**
 * Log with timestamp
 */
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

/**
 * Get next interval with random jitter
 */
function getJitteredInterval() {
    const jitter = intervalMs * JITTER_FACTOR;
    return intervalMs + (Math.random() * 2 - 1) * jitter;
}

/**
 * Schedule the next scrape with jitter
 */
function scheduleNext() {
    if (isShuttingDown) return;
    const nextMs = getJitteredInterval();
    const nextMin = (nextMs / 60000).toFixed(1);
    log(`Next scrape in ${nextMin} minutes`);
    scheduleTimeout = setTimeout(async () => {
        await runScrape();
        scheduleNext();
    }, nextMs);
}

/**
 * Run a single scrape iteration
 */
async function runScrape() {
    if (isShuttingDown) return;

    log(`Scraping: ${topic}`);

    try {
        const result = await scrapeByTopic(topic);

        if (result.success) {
            log(`Completed: ${result.newItems.length} new items (${result.total} total)`);

            if (result.newItems.length > 0) {
                // New ads found - reset the quiet alert timer
                lastNewAdTime = Date.now();
            } else {
                // No new ads - check if we should send a quiet alert
                const timeSinceLastAd = Date.now() - lastNewAdTime;
                if (timeSinceLastAd >= QUIET_ALERT_MS) {
                    const hours = Math.floor(timeSinceLastAd / (60 * 60 * 1000));
                    log(`No new ads for ${hours} hours, sending quiet alert`);
                    try {
                        await sendMessage(`Starting scanning ${topic} on link:\n${project.url}\n\nStill watching - no new listings in the last ${hours} hours.`);
                        // Reset timer so next alert fires in another 6 hours
                        lastNewAdTime = Date.now();
                    } catch (error) {
                        log(`Failed to send quiet alert: ${error.message}`);
                    }
                }
            }
        } else if (result.skipped) {
            log(`Skipped: topic is disabled`);
        }
    } catch (error) {
        log(`Error: ${error.message}`);

        // On captcha/bot detection, restart browser to get a clean fingerprint
        if (error.message && error.message.includes('ShieldSquare Captcha')) {
            log('Bot detection triggered - restarting browser for clean fingerprint');
            await closeBrowser();
        }
    }
}

/**
 * Graceful shutdown
 */
async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log(`Received ${signal}, shutting down gracefully...`);

    if (scheduleTimeout) {
        clearTimeout(scheduleTimeout);
    }

    // Close browser instance
    await closeBrowser();

    log('Shutdown complete');
    process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    log(`Uncaught exception: ${error.message}`);
    log(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    log(`Unhandled rejection: ${reason}`);
});

/**
 * Main entry point
 */
async function main() {
    log(`Starting scraper for: ${topic}`);
    log(`Interval: ${intervalMinutes} minutes`);
    log(`Quiet alert after: 6 hours of no new ads`);
    log(`URL: ${project.url}`);
    log('---');

    // Add random initial delay (0-3 minutes) so multiple scrapers
    // started at the same time don't all hit Yad2 simultaneously
    const initialDelayMs = Math.random() * 3 * 60 * 1000;
    const initialDelaySec = Math.round(initialDelayMs / 1000);
    if (initialDelaySec > 0) {
        log(`Staggering start by ${initialDelaySec}s to avoid simultaneous requests`);
        await new Promise(resolve => setTimeout(resolve, initialDelayMs));
    }

    // Run first scrape
    await runScrape();

    // Schedule next scrape with jitter
    scheduleNext();
}

main().catch(error => {
    log(`Fatal error: ${error.message}`);
    process.exit(1);
});

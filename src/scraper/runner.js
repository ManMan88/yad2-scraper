#!/usr/bin/env node

/**
 * Continuous scraper runner - runs a single topic in a loop
 * Meant to be spawned as a background process by the CLI
 */

const { Command } = require('commander');
const { scrapeByTopic } = require('./index');
const { getProject } = require('../config/loader');
const { closeBrowser } = require('./fetcher');

const program = new Command();

program
    .option('--topic <topic>', 'Topic to scrape (required)')
    .option('--interval <minutes>', 'Interval between scrapes in minutes', '15')
    .parse();

const options = program.opts();

if (!options.topic) {
    console.error('[Runner] Error: --topic is required');
    process.exit(1);
}

const topic = options.topic;
const intervalMinutes = parseInt(options.interval, 10);
const intervalMs = intervalMinutes * 60 * 1000;

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

let intervalId = null;
let isShuttingDown = false;

/**
 * Log with timestamp
 */
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
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
        } else if (result.skipped) {
            log(`Skipped: topic is disabled`);
        }
    } catch (error) {
        log(`Error: ${error.message}`);
    }
}

/**
 * Graceful shutdown
 */
async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log(`Received ${signal}, shutting down gracefully...`);

    if (intervalId) {
        clearInterval(intervalId);
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
    log(`URL: ${project.url}`);
    log('---');

    // Run immediately
    await runScrape();

    // Then run on interval
    intervalId = setInterval(runScrape, intervalMs);

    log(`Next scrape in ${intervalMinutes} minutes`);
}

main().catch(error => {
    log(`Fatal error: ${error.message}`);
    process.exit(1);
});

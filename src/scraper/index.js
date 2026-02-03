const { getYad2Response } = require('./fetcher');
const { parseYad2Html, formatListing } = require('./parser');
const { notifyScanStart, notifyNewItems, notifyNoNewItems, notifyScanFailed } = require('./notifier');
const { checkAndUpdateItems, createPushFlag } = require('./storage');
const { getEnabledProjects, getProject } = require('../config/loader');

/**
 * Scrape a single topic
 * @param {string} topic - Topic name
 * @param {string} url - Yad2 URL to scrape
 * @param {Object} options - Options
 * @param {boolean} options.silent - Don't send Telegram notifications
 */
async function scrape(topic, url, options = {}) {
    const { silent = false } = options;

    try {
        if (!silent) {
            await notifyScanStart(topic, url);
        }

        console.log(`[Scraper] Fetching ${topic}...`);
        const html = await getYad2Response(url);

        console.log(`[Scraper] Parsing ${topic}...`);
        const listings = parseYad2Html(html);
        console.log(`[Scraper] Found ${listings.length} items on page`);

        // Extract IDs (image URLs) for storage comparison
        const currentIds = listings.map(l => l.id);

        // Check which IDs are new
        const { newItems: newIds, hasChanges } = checkAndUpdateItems(currentIds, topic);

        if (hasChanges) {
            createPushFlag();
        }

        if (newIds.length > 0) {
            console.log(`[Scraper] ${newIds.length} new items found!`);
            if (!silent) {
                // Find the full listing objects for new items and format them
                const newIdSet = new Set(newIds);
                const newListings = listings.filter(l => newIdSet.has(l.id));
                const formattedListings = newListings.map(formatListing);
                await notifyNewItems(formattedListings);
            }
        } else {
            console.log(`[Scraper] No new items`);
            if (!silent) {
                await notifyNoNewItems();
            }
        }

        return { success: true, newItems: newIds, total: listings.length };
    } catch (error) {
        console.error(`[Scraper] Error scraping ${topic}:`, error.message);
        if (!silent) {
            await notifyScanFailed(error.message);
        }
        throw error;
    }
}

/**
 * Scrape a single topic by name (looks up from config)
 */
async function scrapeByTopic(topic, options = {}) {
    const project = getProject(topic);
    if (!project) {
        throw new Error(`Topic "${topic}" not found in config`);
    }
    if (project.disabled) {
        console.log(`[Scraper] Topic "${topic}" is disabled, skipping`);
        return { success: false, skipped: true };
    }
    return scrape(topic, project.url, options);
}

/**
 * Scrape all enabled projects
 */
async function scrapeAll(options = {}) {
    const projects = getEnabledProjects();

    if (projects.length === 0) {
        console.log('[Scraper] No enabled projects found');
        return [];
    }

    console.log(`[Scraper] Starting scrape for ${projects.length} projects...`);

    const results = await Promise.all(
        projects.map(async (project) => {
            try {
                const result = await scrape(project.topic, project.url, options);
                return { topic: project.topic, ...result };
            } catch (error) {
                return { topic: project.topic, success: false, error: error.message };
            }
        })
    );

    return results;
}

/**
 * Main program entry point (backward compatible with original scraper.js)
 */
async function program() {
    const results = await scrapeAll();

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success && !r.skipped).length;

    console.log(`[Scraper] Completed: ${successful} successful, ${failed} failed`);

    if (failed > 0) {
        process.exit(1);
    }
}

module.exports = {
    scrape,
    scrapeByTopic,
    scrapeAll,
    program,
};

// Run if called directly
if (require.main === module) {
    program().catch(error => {
        console.error('[Scraper] Fatal error:', error);
        process.exit(1);
    });
}

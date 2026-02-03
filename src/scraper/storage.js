const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../config/loader');

/**
 * Slugify topic name for use in filenames
 */
function slugify(topic) {
    return topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Get the data file path for a topic
 */
function getDataFilePath(topic) {
    const config = loadConfig();
    return path.join(config.dataDir, `${topic}.json`);
}

/**
 * Ensure the data directory exists
 */
function ensureDataDir() {
    const config = loadConfig();
    if (!fs.existsSync(config.dataDir)) {
        fs.mkdirSync(config.dataDir, { recursive: true });
    }
}

/**
 * Load saved URLs for a topic
 */
function loadSavedUrls(topic) {
    const filePath = getDataFilePath(topic);

    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        }
    } catch (error) {
        console.error(`[Storage] Error loading ${filePath}:`, error.message);
    }

    return [];
}

/**
 * Save URLs for a topic
 */
function saveUrls(topic, urls) {
    ensureDataDir();
    const filePath = getDataFilePath(topic);
    const content = JSON.stringify(urls, null, 2);
    fs.writeFileSync(filePath, content);
}

/**
 * Check for new items and update storage
 * @param {string[]} currentUrls - URLs from current scrape
 * @param {string} topic - Topic name
 * @returns {{newItems: string[], hasChanges: boolean}}
 */
function checkAndUpdateItems(currentUrls, topic) {
    const config = loadConfig();
    let savedUrls = loadSavedUrls(topic);
    const originalLength = savedUrls.length;

    // Remove URLs that are no longer in the current scrape (items removed from Yad2)
    savedUrls = savedUrls.filter(savedUrl => currentUrls.includes(savedUrl));
    const removedCount = originalLength - savedUrls.length;

    // Find new items
    const newItems = [];
    for (const url of currentUrls) {
        if (!savedUrls.includes(url)) {
            savedUrls.push(url);
            newItems.push(url);
        }
    }

    // Enforce maxSavedItems limit - keep most recent items
    if (savedUrls.length > config.maxSavedItems) {
        const excess = savedUrls.length - config.maxSavedItems;
        savedUrls = savedUrls.slice(excess);
        console.log(`[Storage] Trimmed ${excess} old items to maintain limit of ${config.maxSavedItems}`);
    }

    // Determine if we need to save
    const hasChanges = removedCount > 0 || newItems.length > 0;

    if (hasChanges) {
        saveUrls(topic, savedUrls);
        console.log(`[Storage] Updated ${topic}: +${newItems.length} new, -${removedCount} removed, ${savedUrls.length} total`);
    }

    return { newItems, hasChanges };
}

/**
 * Create the push flag file for GitHub Actions workflow
 */
function createPushFlag() {
    const flagPath = path.join(process.cwd(), 'push_me');
    fs.writeFileSync(flagPath, '');
}

/**
 * Get item count for a topic
 */
function getItemCount(topic) {
    const urls = loadSavedUrls(topic);
    return urls.length;
}

module.exports = {
    slugify,
    getDataFilePath,
    loadSavedUrls,
    saveUrls,
    checkAndUpdateItems,
    createPushFlag,
    getItemCount,
};

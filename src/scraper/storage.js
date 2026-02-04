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
 * Keeps listings in history even after they disappear from the page
 * to prevent re-notifications when they reappear
 * @param {string[]} currentIds - IDs from current scrape
 * @param {string} topic - Topic name
 * @returns {{newItems: string[], hasChanges: boolean}}
 */
function checkAndUpdateItems(currentIds, topic) {
    const config = loadConfig();
    const savedIds = loadSavedUrls(topic);
    const savedSet = new Set(savedIds);

    // Find new items (on page but not in history)
    const newItems = currentIds.filter(id => !savedSet.has(id));

    // Add new items to history (keep old ones even if not on current page)
    let updatedIds = [...savedIds, ...newItems];

    // Enforce maxSavedItems limit - keep most recent items
    if (updatedIds.length > config.maxSavedItems) {
        const excess = updatedIds.length - config.maxSavedItems;
        updatedIds = updatedIds.slice(excess);
        console.log(`[Storage] Trimmed ${excess} old items to maintain limit of ${config.maxSavedItems}`);
    }

    const hasChanges = newItems.length > 0;

    if (hasChanges) {
        saveUrls(topic, updatedIds);
        console.log(`[Storage] Updated ${topic}: +${newItems.length} new, ${updatedIds.length} total in history`);
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

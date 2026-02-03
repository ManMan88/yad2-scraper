const Telenode = require('telenode-js');
const { loadConfig } = require('../config/loader');

let telenodeInstance = null;

/**
 * Get or create Telegram bot instance
 */
function getTelenode() {
    if (!telenodeInstance) {
        const config = loadConfig();
        if (!config.telegramApiToken) {
            throw new Error('Telegram API token not configured. Set TELEGRAM_API_TOKEN in .env');
        }
        telenodeInstance = new Telenode({ apiToken: config.telegramApiToken });
    }
    return telenodeInstance;
}

/**
 * Send a text message via Telegram
 */
async function sendMessage(message) {
    const config = loadConfig();
    if (!config.chatId) {
        throw new Error('Telegram chat ID not configured. Set TELEGRAM_CHAT_ID in .env');
    }

    const telenode = getTelenode();
    await telenode.sendTextMessage(message, config.chatId);
}

/**
 * Notify scan start
 */
async function notifyScanStart(topic, url) {
    await sendMessage(`Starting scanning ${topic} on link:\n${url}`);
}

/**
 * Notify new items found
 */
async function notifyNewItems(newItems) {
    const newItemsJoined = newItems.join('\n----------\n');
    const msg = `${newItems.length} new items:\n${newItemsJoined}`;
    await sendMessage(msg);
}

/**
 * Notify no new items
 */
async function notifyNoNewItems() {
    await sendMessage('No new items were added');
}

/**
 * Notify scan failure
 */
async function notifyScanFailed(errorMessage) {
    await sendMessage(`Scan workflow failed... \n${errorMessage ? `Error: ${errorMessage}` : ''}`);
}

module.exports = {
    sendMessage,
    notifyScanStart,
    notifyNewItems,
    notifyNoNewItems,
    notifyScanFailed,
};

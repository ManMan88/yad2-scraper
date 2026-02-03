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
 * Send a text message to all configured recipients
 */
async function sendMessage(message) {
    const config = loadConfig();
    const chatIds = config.chatIds || [];

    if (chatIds.length === 0) {
        throw new Error('No Telegram chat IDs configured. Set TELEGRAM_CHAT_ID in .env');
    }

    const telenode = getTelenode();

    // Send to all recipients
    const results = await Promise.allSettled(
        chatIds.map(chatId => telenode.sendTextMessage(message, chatId))
    );

    // Log any failures
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(`[Notifier] Failed to send to ${chatIds[index]}: ${result.reason}`);
        }
    });

    // Throw if all failed
    const allFailed = results.every(r => r.status === 'rejected');
    if (allFailed) {
        throw new Error('Failed to send message to any recipient');
    }
}

/**
 * Notify scan start
 */
async function notifyScanStart(topic, url) {
    await sendMessage(`Starting scanning ${topic} on link:\n${url}`);
}

/**
 * Notify new items found
 * Splits into multiple messages if needed (Telegram has 4096 char limit)
 * @param {Array<string|Object>} newItems - Array of formatted strings or listing objects
 */
async function notifyNewItems(newItems) {
    const MAX_MESSAGE_LENGTH = 4000; // Leave some buffer below 4096
    const SEPARATOR = '\n\n----------\n\n';

    // Send header first
    await sendMessage(`${newItems.length} new listing${newItems.length === 1 ? '' : 's'}:`);

    // Build messages in chunks that fit within limit
    let currentMessage = '';

    for (const item of newItems) {
        const itemText = currentMessage ? SEPARATOR + item : item;

        if (currentMessage.length + itemText.length > MAX_MESSAGE_LENGTH) {
            // Send current chunk and start new one
            if (currentMessage) {
                await sendMessage(currentMessage);
            }
            currentMessage = item;
        } else {
            currentMessage += itemText;
        }
    }

    // Send remaining items
    if (currentMessage) {
        await sendMessage(currentMessage);
    }
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

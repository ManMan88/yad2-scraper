const Table = require('cli-table3');
const { getAllScrapersStatus } = require('../utils/processManager');

/**
 * Format uptime string
 */
function formatUptime(startDate) {
    if (!startDate) return '-';

    const now = new Date();
    const diff = now - new Date(startDate);

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
}

/**
 * Format time ago string
 */
function timeAgo(date) {
    if (!date) return '-';

    const now = new Date();
    const diff = now - new Date(date);

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
}

/**
 * Active command handler - list only running scrapers
 */
async function activeCommand() {
    const statuses = getAllScrapersStatus();
    const running = statuses.filter(s => s.running);

    if (running.length === 0) {
        console.log('No scrapers are currently running.');
        console.log('\nUse "yad2 start <topic>" or "yad2 start --all" to start scrapers.');
        return;
    }

    const table = new Table({
        head: ['Topic', 'PID', 'Uptime', 'Last Activity'],
        colWidths: [25, 10, 15, 15],
        style: {
            head: ['cyan'],
        },
    });

    for (const status of running) {
        table.push([
            status.topic,
            status.pid,
            formatUptime(status.startedAt),
            timeAgo(status.lastRun),
        ]);
    }

    console.log('\nActive Scrapers:\n');
    console.log(table.toString());
    console.log(`\n${running.length} scraper(s) running`);
}

module.exports = { activeCommand };

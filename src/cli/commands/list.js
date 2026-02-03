const Table = require('cli-table3');
const { getAllScrapersStatus } = require('../utils/processManager');
const { getItemCount } = require('../../scraper/storage');

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
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
}

/**
 * Format uptime string
 */
function uptime(startDate) {
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
 * List command handler
 */
async function listCommand(options) {
    const statuses = getAllScrapersStatus();

    if (statuses.length === 0) {
        console.log('No projects configured in config.json');
        return;
    }

    const table = new Table({
        head: ['Topic', 'Status', 'PID', 'Items', 'Last Run'],
        colWidths: [25, 12, 8, 8, 12],
        style: {
            head: ['cyan'],
        },
    });

    for (const status of statuses) {
        let statusText;
        if (status.disabled) {
            statusText = 'disabled';
        } else if (status.running) {
            statusText = 'running';
        } else {
            statusText = 'stopped';
        }

        const itemCount = getItemCount(status.topic);

        table.push([
            status.topic,
            statusText,
            status.pid || '-',
            itemCount || '-',
            timeAgo(status.lastRun),
        ]);
    }

    console.log(table.toString());

    const running = statuses.filter(s => s.running).length;
    const stopped = statuses.filter(s => !s.running && !s.disabled).length;
    const disabled = statuses.filter(s => s.disabled).length;

    console.log(`\n${running} running, ${stopped} stopped, ${disabled} disabled`);
}

module.exports = { listCommand };

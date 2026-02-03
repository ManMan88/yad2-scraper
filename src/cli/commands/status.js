const { getScraperStatus, getLogFilePath } = require('../utils/processManager');
const { getProject } = require('../../config/loader');
const { getItemCount, getDataFilePath } = require('../../scraper/storage');
const fs = require('fs');

/**
 * Format date string
 */
function formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleString();
}

/**
 * Status command handler
 */
async function statusCommand(topic) {
    if (!topic) {
        console.error('Error: Topic name is required');
        console.log('Usage: yad2 status <topic>');
        process.exit(1);
    }

    const project = getProject(topic);
    if (!project) {
        console.error(`Error: Topic "${topic}" not found in config.json`);
        process.exit(1);
    }

    const status = getScraperStatus(topic);
    const itemCount = getItemCount(topic);
    const dataFile = getDataFilePath(topic);
    const logFile = getLogFilePath(topic);

    console.log(`\nStatus for "${topic}"`);
    console.log('='.repeat(40));

    console.log(`\nConfiguration:`);
    console.log(`  URL: ${project.url.substring(0, 60)}...`);
    console.log(`  Disabled: ${project.disabled ? 'Yes' : 'No'}`);

    console.log(`\nProcess:`);
    console.log(`  Status: ${status.running ? 'Running' : 'Stopped'}`);
    console.log(`  PID: ${status.pid || '-'}`);
    console.log(`  Started: ${formatDate(status.startedAt)}`);

    console.log(`\nData:`);
    console.log(`  Items tracked: ${itemCount}`);
    console.log(`  Data file: ${fs.existsSync(dataFile) ? dataFile : '(not created yet)'}`);

    console.log(`\nLogs:`);
    console.log(`  Log file: ${fs.existsSync(logFile) ? logFile : '(no logs yet)'}`);
    console.log(`  Last activity: ${formatDate(status.lastRun)}`);

    // Show last few log lines if available
    if (fs.existsSync(logFile)) {
        console.log(`\nRecent logs:`);
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter(l => l.trim()).slice(-5);
        lines.forEach(line => console.log(`  ${line}`));
    }

    console.log('');
}

module.exports = { statusCommand };

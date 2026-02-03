const Table = require('cli-table3');
const { getAllProjects } = require('../../config/loader');

/**
 * Truncate URL for display
 */
function truncateUrl(url, maxLength = 50) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
}

/**
 * Scrapers command handler - list all configured scrapers
 */
async function scrapersCommand() {
    const projects = getAllProjects();

    if (projects.length === 0) {
        console.log('No scrapers configured.');
        console.log('\nUse "yad2 add" to create a new scraper.');
        return;
    }

    const table = new Table({
        head: ['Topic', 'URL', 'Status'],
        colWidths: [25, 55, 12],
        style: {
            head: ['cyan'],
        },
    });

    for (const project of projects) {
        table.push([
            project.topic,
            truncateUrl(project.url),
            project.disabled ? 'disabled' : 'enabled',
        ]);
    }

    console.log('\nConfigured Scrapers:\n');
    console.log(table.toString());

    const enabled = projects.filter(p => !p.disabled).length;
    const disabled = projects.filter(p => p.disabled).length;

    console.log(`\n${enabled} enabled, ${disabled} disabled`);
    console.log('\nUse "yad2 list" to see running status.');
}

module.exports = { scrapersCommand };

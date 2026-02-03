const { stopScraper, isRunning, getAllScrapersStatus } = require('../utils/processManager');
const { getProject, getAllProjects } = require('../../config/loader');

/**
 * Stop command handler
 */
async function stopCommand(topic, options) {
    const { all } = options;

    if (all || !topic) {
        // Stop all running scrapers
        const statuses = getAllScrapersStatus();
        const running = statuses.filter(s => s.running);

        if (running.length === 0) {
            console.log('No scrapers are currently running.');
            return;
        }

        console.log(`Stopping ${running.length} scraper(s)...\n`);

        for (const status of running) {
            try {
                const result = await stopScraper(status.topic);
                if (result.graceful) {
                    console.log(`  [ok]   "${status.topic}" stopped gracefully`);
                } else {
                    console.log(`  [ok]   "${status.topic}" force killed`);
                }
            } catch (error) {
                console.error(`  [fail] "${status.topic}": ${error.message}`);
            }
        }

        console.log('\nDone.');
        return;
    }

    // Stop specific topic
    const project = getProject(topic);
    if (!project) {
        console.error(`Error: Topic "${topic}" not found in config.json`);
        process.exit(1);
    }

    if (!isRunning(topic)) {
        console.log(`Scraper "${topic}" is not running.`);
        return;
    }

    try {
        console.log(`Stopping "${topic}"...`);
        const result = await stopScraper(topic);

        if (result.graceful) {
            console.log(`Stopped "${topic}" gracefully.`);
        } else {
            console.log(`Force killed "${topic}".`);
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

module.exports = { stopCommand };

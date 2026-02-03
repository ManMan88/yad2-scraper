const readline = require('readline');
const fs = require('fs');
const { removeProject, getProject } = require('../../config/loader');
const { isRunning, stopScraper, getLogFilePath, getPidFilePath } = require('../utils/processManager');
const { getDataFilePath } = require('../../scraper/storage');

/**
 * Prompt user for confirmation
 */
function confirm(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
        });
    });
}

/**
 * Remove command handler
 */
async function removeCommand(topic, options) {
    const { force, cleanup } = options;

    if (!topic) {
        console.error('Error: Topic name is required');
        console.log('Usage: yad2 remove <topic> [--force] [--cleanup]');
        process.exit(1);
    }

    const project = getProject(topic);
    if (!project) {
        console.error(`Error: Topic "${topic}" not found in config.json`);
        process.exit(1);
    }

    // Confirm removal unless --force
    if (!force) {
        const confirmed = await confirm(`Remove scraper "${topic}"? (y/N): `);
        if (!confirmed) {
            console.log('Cancelled.');
            return;
        }
    }

    // Stop if running
    if (isRunning(topic)) {
        console.log(`Stopping "${topic}"...`);
        try {
            await stopScraper(topic);
            console.log(`Stopped "${topic}".`);
        } catch (error) {
            console.error(`Warning: Could not stop scraper: ${error.message}`);
        }
    }

    // Remove from config
    removeProject(topic);
    console.log(`Removed "${topic}" from config.json`);

    // Clean up data/logs if requested
    if (cleanup) {
        const dataFile = getDataFilePath(topic);
        const logFile = getLogFilePath(topic);
        const pidFile = getPidFilePath(topic);

        const files = [dataFile, logFile, pidFile];
        let cleaned = 0;

        for (const file of files) {
            if (fs.existsSync(file)) {
                try {
                    fs.unlinkSync(file);
                    cleaned++;
                } catch (error) {
                    console.error(`Warning: Could not delete ${file}: ${error.message}`);
                }
            }
        }

        if (cleaned > 0) {
            console.log(`Cleaned up ${cleaned} file(s).`);
        }
    }

    console.log('\nDone.');
}

module.exports = { removeCommand };

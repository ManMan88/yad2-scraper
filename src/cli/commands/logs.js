const fs = require('fs');
const { spawn } = require('child_process');
const { getLogFilePath } = require('../utils/processManager');
const { getProject } = require('../../config/loader');

/**
 * Logs command handler
 */
async function logsCommand(topic, options) {
    const { follow, lines } = options;

    if (!topic) {
        console.error('Error: Topic name is required');
        console.log('Usage: yad2 logs <topic> [--follow] [--lines N]');
        process.exit(1);
    }

    const project = getProject(topic);
    if (!project) {
        console.error(`Error: Topic "${topic}" not found in config.json`);
        process.exit(1);
    }

    const logFile = getLogFilePath(topic);

    if (!fs.existsSync(logFile)) {
        console.log(`No logs found for "${topic}"`);
        console.log(`Log file would be at: ${logFile}`);
        console.log('\nThe scraper may not have been run yet.');
        return;
    }

    if (follow) {
        // Use tail -f for following
        console.log(`Following logs for "${topic}" (Ctrl+C to stop)...\n`);
        console.log('---');

        const tail = spawn('tail', ['-f', '-n', String(lines), logFile], {
            stdio: 'inherit',
        });

        tail.on('error', (error) => {
            console.error(`Error: ${error.message}`);
            process.exit(1);
        });

        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
            tail.kill();
            process.exit(0);
        });

        // Keep process running
        await new Promise(() => {});
    } else {
        // Just read last N lines
        const content = fs.readFileSync(logFile, 'utf8');
        const allLines = content.split('\n');
        const lastLines = allLines.slice(-lines).join('\n');

        console.log(`Last ${lines} lines of logs for "${topic}":\n`);
        console.log('---');
        console.log(lastLines);
        console.log('---');
        console.log(`\nLog file: ${logFile}`);
        console.log(`Use --follow (-f) to stream live logs.`);
    }
}

module.exports = { logsCommand };

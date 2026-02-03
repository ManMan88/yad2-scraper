const readline = require('readline');
const { addProject, getProject } = require('../../config/loader');
const { startScraper } = require('../utils/processManager');

/**
 * Create readline interface for prompts
 */
function createPrompt() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
}

/**
 * Prompt user for input
 */
function ask(rl, question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

/**
 * Validate Yad2 URL format
 */
function isValidYad2Url(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname.includes('yad2.co.il');
    } catch {
        return false;
    }
}

/**
 * Add command handler - interactive wizard
 */
async function addCommand(options) {
    const { topic: optTopic, url: optUrl, start: optStart } = options;

    // Non-interactive mode if all required options provided
    if (optTopic && optUrl) {
        if (getProject(optTopic)) {
            console.error(`Error: Topic "${optTopic}" already exists`);
            process.exit(1);
        }

        if (!isValidYad2Url(optUrl)) {
            console.error('Error: URL must be a valid yad2.co.il URL');
            process.exit(1);
        }

        addProject({ topic: optTopic, url: optUrl, disabled: false });
        console.log(`Added scraper "${optTopic}"`);

        if (optStart) {
            try {
                const pid = startScraper(optTopic, { interval: 15 });
                console.log(`Started "${optTopic}" (PID: ${pid})`);
            } catch (error) {
                console.error(`Warning: Could not start scraper: ${error.message}`);
            }
        }
        return;
    }

    // Interactive mode
    const rl = createPrompt();

    console.log('\n=== Add New Scraper ===\n');

    try {
        // Prompt for topic name
        let topic;
        while (true) {
            topic = await ask(rl, 'Topic name (e.g., "Tel Aviv 3 rooms"): ');

            if (!topic) {
                console.log('  Error: Topic name is required.\n');
                continue;
            }

            if (getProject(topic)) {
                console.log(`  Error: Topic "${topic}" already exists.\n`);
                continue;
            }

            break;
        }

        // Prompt for URL
        let url;
        while (true) {
            url = await ask(rl, 'Yad2 URL: ');

            if (!url) {
                console.log('  Error: URL is required.\n');
                continue;
            }

            if (!isValidYad2Url(url)) {
                console.log('  Error: URL must be a valid yad2.co.il URL.\n');
                continue;
            }

            break;
        }

        // Prompt for immediate start
        const startNow = await ask(rl, 'Start scraper now? (y/N): ');
        const shouldStart = startNow.toLowerCase() === 'y' || startNow.toLowerCase() === 'yes';

        rl.close();

        // Add to config
        addProject({ topic, url, disabled: false });
        console.log(`\nAdded scraper "${topic}" to config.json`);

        // Start if requested
        if (shouldStart) {
            try {
                const pid = startScraper(topic, { interval: 15 });
                console.log(`Started "${topic}" (PID: ${pid})`);
                console.log(`\nUse "yad2 logs "${topic}"" to view logs.`);
            } catch (error) {
                console.error(`Warning: Could not start scraper: ${error.message}`);
            }
        } else {
            console.log(`\nUse "yad2 start "${topic}"" to begin scraping.`);
        }
    } catch (error) {
        rl.close();
        console.error(`\nError: ${error.message}`);
        process.exit(1);
    }
}

module.exports = { addCommand };

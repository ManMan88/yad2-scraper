const readline = require('readline');
const { getProject, updateProject } = require('../../config/loader');

/**
 * Create readline interface
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
 * Edit command handler
 */
async function editCommand(topic, options) {
    const { url, enable, disable } = options;

    if (!topic) {
        console.error('Error: Topic name is required');
        console.log('Usage: yad2 edit <topic> [--url <url>] [--enable] [--disable]');
        process.exit(1);
    }

    const project = getProject(topic);
    if (!project) {
        console.error(`Error: Topic "${topic}" not found in config.json`);
        process.exit(1);
    }

    // If flags provided, use them directly (non-interactive mode)
    if (url || enable || disable) {
        const updates = {};

        if (url) {
            updates.url = url;
        }
        if (enable) {
            updates.disabled = false;
        }
        if (disable) {
            updates.disabled = true;
        }

        updateProject(topic, updates);
        console.log(`Updated "${topic}":`);
        if (url) console.log(`  URL: ${url}`);
        if (enable) console.log(`  Status: enabled`);
        if (disable) console.log(`  Status: disabled`);
        return;
    }

    // Interactive mode
    const rl = createPrompt();

    console.log(`\n=== Edit Scraper: ${topic} ===\n`);
    console.log(`Current URL: ${project.url}`);
    console.log(`Current status: ${project.disabled ? 'disabled' : 'enabled'}\n`);

    try {
        // Prompt for new URL (or keep current)
        const newUrl = await ask(rl, 'New URL (press Enter to keep current): ');

        // Prompt for enable/disable
        const toggleStatus = await ask(rl, 'Toggle enabled status? (y/N): ');
        const shouldToggle = toggleStatus.toLowerCase() === 'y' || toggleStatus.toLowerCase() === 'yes';

        rl.close();

        const updates = {};
        let changed = false;

        if (newUrl) {
            updates.url = newUrl;
            changed = true;
        }

        if (shouldToggle) {
            updates.disabled = !project.disabled;
            changed = true;
        }

        if (changed) {
            updateProject(topic, updates);
            console.log(`\nUpdated "${topic}"`);
            if (newUrl) console.log(`  URL: ${newUrl}`);
            if (shouldToggle) console.log(`  Status: ${updates.disabled ? 'disabled' : 'enabled'}`);
        } else {
            console.log('\nNo changes made.');
        }
    } catch (error) {
        rl.close();
        console.error(`\nError: ${error.message}`);
        process.exit(1);
    }
}

module.exports = { editCommand };

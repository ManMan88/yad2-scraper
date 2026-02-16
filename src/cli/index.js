#!/usr/bin/env node

const { Command } = require('commander');
const { startCommand } = require('./commands/start');
const { stopCommand } = require('./commands/stop');
const { listCommand } = require('./commands/list');
const { logsCommand } = require('./commands/logs');
const { statusCommand } = require('./commands/status');
const { runCommand } = require('./commands/run');
const { addCommand } = require('./commands/add');
const { removeCommand } = require('./commands/remove');
const { editCommand } = require('./commands/edit');
const { scrapersCommand } = require('./commands/scrapers');
const { activeCommand } = require('./commands/active');
const { fromUrlCommand } = require('./commands/from-url');

const program = new Command();

program
    .name('yad2')
    .description('Yad2 real estate scraper with bot management')
    .version('2.0.0');

// Start command
program
    .command('start [topic]')
    .description('Start scraper(s) as background process')
    .option('-i, --interval <minutes>', 'Scrape interval in minutes', '20')
    .option('-f, --foreground', 'Run in foreground (don\'t detach)')
    .option('-a, --all', 'Start all enabled scrapers')
    .action((topic, options) => {
        startCommand(topic, options);
    });

// Stop command
program
    .command('stop [topic]')
    .description('Stop running scraper(s)')
    .option('-a, --all', 'Stop all running scrapers')
    .action(async (topic, options) => {
        await stopCommand(topic, options);
    });

// List command
program
    .command('list')
    .alias('ls')
    .description('List all scrapers and their status')
    .action(async (options) => {
        await listCommand(options);
    });

// Logs command
program
    .command('logs <topic>')
    .description('View scraper logs')
    .option('-f, --follow', 'Follow log output in real-time')
    .option('-n, --lines <number>', 'Number of lines to show', '50')
    .action(async (topic, options) => {
        await logsCommand(topic, options);
    });

// Status command
program
    .command('status <topic>')
    .description('Get detailed status for a scraper')
    .action(async (topic) => {
        await statusCommand(topic);
    });

// Run command (one-shot)
program
    .command('run [topic]')
    .description('Run a single scrape (one-shot mode)')
    .option('-s, --silent', 'Don\'t send Telegram notifications')
    .option('-a, --all', 'Run all enabled scrapers')
    .action(async (topic, options) => {
        await runCommand(topic, options);
    });

// Add command (interactive wizard)
program
    .command('add')
    .description('Add a new scraper (interactive wizard)')
    .option('-t, --topic <topic>', 'Topic name (non-interactive)')
    .option('-u, --url <url>', 'Yad2 URL (non-interactive)')
    .option('-s, --start', 'Start scraper immediately after adding')
    .action(async (options) => {
        await addCommand(options);
    });

// Remove command
program
    .command('remove <topic>')
    .alias('rm')
    .description('Remove a scraper')
    .option('-f, --force', 'Skip confirmation prompt')
    .option('-c, --cleanup', 'Also delete data and log files')
    .action(async (topic, options) => {
        await removeCommand(topic, options);
    });

// Edit command
program
    .command('edit <topic>')
    .description('Edit an existing scraper')
    .option('-u, --url <url>', 'Set new URL')
    .option('-e, --enable', 'Enable the scraper')
    .option('-d, --disable', 'Disable the scraper')
    .action(async (topic, options) => {
        await editCommand(topic, options);
    });

// Scrapers command (config-focused listing)
program
    .command('scrapers')
    .description('List all configured scrapers')
    .action(async () => {
        await scrapersCommand();
    });

// Active command (running scrapers only)
program
    .command('active')
    .description('List only running scrapers')
    .action(async () => {
        await activeCommand();
    });

// From-URL command (quick create from search URL)
program
    .command('from-url <url>')
    .description('Create scraper from Yad2 search URL')
    .option('-n, --name <name>', 'Custom name (otherwise auto-generated)')
    .option('-s, --start', 'Start scraper immediately after creating')
    .action(async (url, options) => {
        await fromUrlCommand(url, options);
    });

// Parse and execute
program.parse();

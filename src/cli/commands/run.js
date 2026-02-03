const { scrapeByTopic, scrapeAll } = require('../../scraper');
const { getProject } = require('../../config/loader');

/**
 * Run command handler - execute a single scrape (one-shot mode)
 */
async function runCommand(topic, options) {
    const { silent, all } = options;

    if (all || !topic) {
        // Run all enabled scrapers once
        console.log('Running one-shot scrape for all enabled projects...\n');

        try {
            const results = await scrapeAll({ silent });

            console.log('\nResults:');
            for (const result of results) {
                if (result.success) {
                    console.log(`  [ok]   "${result.topic}": ${result.newItems.length} new items`);
                } else if (result.skipped) {
                    console.log(`  [skip] "${result.topic}": disabled`);
                } else {
                    console.log(`  [fail] "${result.topic}": ${result.error}`);
                }
            }

            const failed = results.filter(r => !r.success && !r.skipped);
            if (failed.length > 0) {
                process.exit(1);
            }
        } catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(1);
        }
        return;
    }

    // Run specific topic once
    const project = getProject(topic);
    if (!project) {
        console.error(`Error: Topic "${topic}" not found in config.json`);
        process.exit(1);
    }

    console.log(`Running one-shot scrape for "${topic}"...\n`);

    try {
        const result = await scrapeByTopic(topic, { silent });

        if (result.skipped) {
            console.log(`Topic "${topic}" is disabled.`);
            return;
        }

        console.log(`\nCompleted: ${result.newItems.length} new items found (${result.total} total on page)`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

module.exports = { runCommand };

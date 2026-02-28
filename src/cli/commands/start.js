const { startScraper, isRunning, getPid } = require('../utils/processManager');
const { getProject, getEnabledProjects } = require('../../config/loader');

/**
 * Start command handler
 */
async function startCommand(topic, options) {
    const { interval, foreground, all } = options;

    if (all || !topic) {
        // Start all enabled scrapers
        const projects = getEnabledProjects();

        if (projects.length === 0) {
            console.log('No enabled projects found in config.json');
            return;
        }

        console.log(`Starting ${projects.length} scraper(s) (staggered by 3 min each)...\n`);

        let staggerIndex = 0;
        for (const project of projects) {
            try {
                if (isRunning(project.topic)) {
                    const pid = getPid(project.topic);
                    console.log(`  [skip] "${project.topic}" already running (PID: ${pid})`);
                    continue;
                }

                const pid = startScraper(project.topic, { interval, foreground: false, staggerIndex });
                const delaySec = staggerIndex * 180;
                console.log(`  [ok]   "${project.topic}" started (PID: ${pid}${delaySec > 0 ? `, stagger: ${delaySec}s` : ''})`);
                staggerIndex++;
            } catch (error) {
                console.error(`  [fail] "${project.topic}": ${error.message}`);
            }
        }

        console.log('\nDone. Use "yad2 list" to see status.');
        return;
    }

    // Start specific topic
    const project = getProject(topic);
    if (!project) {
        console.error(`Error: Topic "${topic}" not found in config.json`);
        console.log('\nAvailable topics:');
        const { getAllProjects } = require('../../config/loader');
        getAllProjects().forEach(p => {
            console.log(`  - ${p.topic}${p.disabled ? ' (disabled)' : ''}`);
        });
        process.exit(1);
    }

    if (project.disabled) {
        console.error(`Error: Topic "${topic}" is disabled in config.json`);
        process.exit(1);
    }

    try {
        if (foreground) {
            console.log(`Starting "${topic}" in foreground (interval: ${interval} min)...`);
            console.log('Press Ctrl+C to stop.\n');
            startScraper(topic, { interval, foreground: true });
        } else {
            const pid = startScraper(topic, { interval });
            console.log(`Started "${topic}" (PID: ${pid}, interval: ${interval} min)`);
            console.log(`\nLogs: yad2 logs "${topic}"`);
            console.log(`Stop: yad2 stop "${topic}"`);
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

module.exports = { startCommand };

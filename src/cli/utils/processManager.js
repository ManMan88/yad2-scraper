const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../../config/loader');

/**
 * Slugify topic name for filenames
 */
function slugify(topic) {
    return topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Get PID file path for a topic
 */
function getPidFilePath(topic) {
    const config = loadConfig();
    const slug = slugify(topic);
    return path.join(config.pidsDir, `${slug}.pid`);
}

/**
 * Get log file path for a topic
 */
function getLogFilePath(topic) {
    const config = loadConfig();
    const slug = slugify(topic);
    return path.join(config.logsDir, `${slug}.log`);
}

/**
 * Ensure directories exist
 */
function ensureDirs() {
    const config = loadConfig();
    if (!fs.existsSync(config.pidsDir)) {
        fs.mkdirSync(config.pidsDir, { recursive: true });
    }
    if (!fs.existsSync(config.logsDir)) {
        fs.mkdirSync(config.logsDir, { recursive: true });
    }
}

/**
 * Check if a process is running by PID
 */
function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Check if a scraper is running for a topic
 */
function isRunning(topic) {
    const pidFile = getPidFilePath(topic);
    if (!fs.existsSync(pidFile)) {
        return false;
    }

    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
    if (isProcessRunning(pid)) {
        return true;
    }

    // Stale PID file - process doesn't exist
    try {
        fs.unlinkSync(pidFile);
    } catch (e) {
        // Ignore cleanup errors
    }
    return false;
}

/**
 * Get PID for a running scraper
 */
function getPid(topic) {
    const pidFile = getPidFilePath(topic);
    if (!fs.existsSync(pidFile)) {
        return null;
    }
    return parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
}

/**
 * Start a scraper for a topic
 * @param {string} topic - Topic name
 * @param {Object} options - Options
 * @param {number} options.interval - Interval in minutes (default: 15)
 * @param {boolean} options.foreground - Run in foreground (don't detach)
 * @returns {number} PID of the spawned process
 */
function startScraper(topic, options = {}) {
    const { interval = 15, foreground = false } = options;

    ensureDirs();

    if (isRunning(topic)) {
        const pid = getPid(topic);
        throw new Error(`Scraper "${topic}" is already running (PID: ${pid})`);
    }

    const pidFile = getPidFilePath(topic);
    const logFile = getLogFilePath(topic);
    const runnerPath = path.join(__dirname, '../../scraper/runner.js');

    if (foreground) {
        // Run in foreground - attach stdio
        const child = spawn('node', [runnerPath, '--topic', topic, '--interval', String(interval)], {
            stdio: 'inherit',
            env: { ...process.env },
        });
        return child.pid;
    }

    // Run in background - detached process
    const out = fs.openSync(logFile, 'a');
    const err = fs.openSync(logFile, 'a');

    const child = spawn('node', [runnerPath, '--topic', topic, '--interval', String(interval)], {
        detached: true,
        stdio: ['ignore', out, err],
        env: { ...process.env },
    });

    // Write PID file
    fs.writeFileSync(pidFile, String(child.pid));

    // Detach from parent
    child.unref();

    return child.pid;
}

/**
 * Stop a scraper for a topic
 * @param {string} topic - Topic name
 * @param {Object} options - Options
 * @param {number} options.timeout - Grace period in ms before SIGKILL (default: 5000)
 */
function stopScraper(topic, options = {}) {
    const { timeout = 5000 } = options;

    const pidFile = getPidFilePath(topic);
    if (!fs.existsSync(pidFile)) {
        throw new Error(`Scraper "${topic}" is not running (no PID file)`);
    }

    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);

    if (!isProcessRunning(pid)) {
        // Process already dead, clean up PID file
        fs.unlinkSync(pidFile);
        return { wasRunning: false };
    }

    // Send SIGTERM for graceful shutdown
    try {
        process.kill(pid, 'SIGTERM');
    } catch (e) {
        // Process may have exited between check and kill
    }

    // Wait for process to exit
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (!isProcessRunning(pid)) {
                clearInterval(checkInterval);
                clearTimeout(forceKillTimeout);
                try {
                    fs.unlinkSync(pidFile);
                } catch (e) {
                    // Ignore
                }
                resolve({ wasRunning: true, graceful: true });
            }
        }, 100);

        // Force kill after timeout
        const forceKillTimeout = setTimeout(() => {
            clearInterval(checkInterval);
            try {
                process.kill(pid, 'SIGKILL');
            } catch (e) {
                // Ignore
            }
            try {
                fs.unlinkSync(pidFile);
            } catch (e) {
                // Ignore
            }
            resolve({ wasRunning: true, graceful: false });
        }, timeout);
    });
}

/**
 * Get status info for a scraper
 */
function getScraperStatus(topic) {
    const pidFile = getPidFilePath(topic);
    const logFile = getLogFilePath(topic);

    const running = isRunning(topic);
    const pid = running ? getPid(topic) : null;

    let lastRun = null;
    let startedAt = null;

    // Try to get info from log file
    if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        lastRun = stats.mtime;

        // Read last few lines to find start time
        try {
            const content = fs.readFileSync(logFile, 'utf8');
            const lines = content.split('\n').filter(l => l.trim());
            const startLine = lines.find(l => l.includes('Starting scraper for:'));
            if (startLine) {
                const match = startLine.match(/\[([^\]]+)\]/);
                if (match) {
                    startedAt = new Date(match[1]);
                }
            }
        } catch (e) {
            // Ignore read errors
        }
    }

    return {
        topic,
        running,
        pid,
        lastRun,
        startedAt,
        logFile: fs.existsSync(logFile) ? logFile : null,
    };
}

/**
 * Get all scrapers status
 */
function getAllScrapersStatus() {
    const { getAllProjects } = require('../../config/loader');
    const projects = getAllProjects();

    return projects.map(project => ({
        ...getScraperStatus(project.topic),
        disabled: project.disabled || false,
        url: project.url,
    }));
}

module.exports = {
    slugify,
    getPidFilePath,
    getLogFilePath,
    isRunning,
    getPid,
    startScraper,
    stopScraper,
    getScraperStatus,
    getAllScrapersStatus,
};

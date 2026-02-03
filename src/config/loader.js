const path = require('path');
const fs = require('fs');

// Load .env file if it exists
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const CONFIG_PATH = path.join(__dirname, '../../config.json');

function loadConfig() {
    let fileConfig = {};

    if (fs.existsSync(CONFIG_PATH)) {
        fileConfig = require(CONFIG_PATH);
    }

    return {
        // Telegram settings - env vars take precedence
        telegramApiToken: process.env.TELEGRAM_API_TOKEN || process.env.API_TOKEN || fileConfig.telegramApiToken,
        chatId: process.env.TELEGRAM_CHAT_ID || process.env.CHAT_ID || fileConfig.chatId,

        // Scraper settings
        maxSavedItems: fileConfig.maxSavedItems || 500,

        // Projects array
        projects: fileConfig.projects || [],

        // Paths - configurable via env
        dataDir: process.env.DATA_DIR || path.join(__dirname, '../../data'),
        logsDir: process.env.LOGS_DIR || path.join(__dirname, '../../logs'),
        pidsDir: process.env.PIDS_DIR || path.join(__dirname, '../../pids'),

        // Rate limiting
        requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS) || 1000,
        maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
    };
}

function getProject(topic) {
    const config = loadConfig();
    return config.projects.find(p => p.topic === topic);
}

function getEnabledProjects() {
    const config = loadConfig();
    return config.projects.filter(p => !p.disabled);
}

function getAllProjects() {
    const config = loadConfig();
    return config.projects;
}

/**
 * Load raw config from file (without env var merging)
 */
function loadRawConfig() {
    if (fs.existsSync(CONFIG_PATH)) {
        const content = fs.readFileSync(CONFIG_PATH, 'utf8');
        return JSON.parse(content);
    }
    return { maxSavedItems: 500, projects: [] };
}

/**
 * Save config to file
 */
function saveConfig(config) {
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(CONFIG_PATH, content);
}

/**
 * Add a new project to config
 * @param {Object} project - {topic, url, disabled}
 * @throws {Error} if topic already exists
 */
function addProject(project) {
    const config = loadRawConfig();

    if (config.projects.find(p => p.topic === project.topic)) {
        throw new Error(`Topic "${project.topic}" already exists`);
    }

    config.projects.push({
        topic: project.topic,
        url: project.url,
        disabled: project.disabled || false,
    });

    saveConfig(config);
}

/**
 * Remove a project from config
 * @param {string} topic - Topic name to remove
 * @returns {Object|null} removed project or null if not found
 */
function removeProject(topic) {
    const config = loadRawConfig();
    const index = config.projects.findIndex(p => p.topic === topic);

    if (index === -1) {
        return null;
    }

    const removed = config.projects.splice(index, 1)[0];
    saveConfig(config);
    return removed;
}

/**
 * Update an existing project
 * @param {string} topic - Topic name to update
 * @param {Object} updates - Fields to update (url, disabled)
 * @returns {Object|null} updated project or null if not found
 */
function updateProject(topic, updates) {
    const config = loadRawConfig();
    const project = config.projects.find(p => p.topic === topic);

    if (!project) {
        return null;
    }

    if (updates.url !== undefined) {
        project.url = updates.url;
    }
    if (updates.disabled !== undefined) {
        project.disabled = updates.disabled;
    }

    saveConfig(config);
    return project;
}

module.exports = {
    loadConfig,
    getProject,
    getEnabledProjects,
    getAllProjects,
    addProject,
    removeProject,
    updateProject,
};

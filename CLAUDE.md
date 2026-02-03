# CLAUDE.md - Project Context for AI Assistants

## Project Overview

**yad2-scraper** is a Node.js CLI tool that scrapes the Israeli real estate marketplace Yad2 (yad2.co.il) and sends Telegram notifications when new listings are found.

## Architecture

### Core Components

1. **CLI (`src/cli/`)** - Commander.js-based CLI with commands for managing scrapers
2. **Scraper (`src/scraper/`)** - Puppeteer-based scraping with stealth plugin to bypass bot detection
3. **Config (`src/config/`)** - Configuration loading with .env support

### Key Files

| File | Purpose |
|------|---------|
| `src/cli/index.js` | Main CLI entry point, registers all commands |
| `src/scraper/fetcher.js` | Puppeteer with stealth plugin for fetching pages |
| `src/scraper/parser.js` | Cheerio-based HTML parsing for Yad2's DOM |
| `src/scraper/runner.js` | Continuous runner for background scraping |
| `src/config/loader.js` | Config loading, saving, and project management |
| `config.json` | Stores scraper configurations (projects array) |

### Process Management

- Scrapers run as detached Node.js processes
- PID files stored in `pids/<topic-slug>.pid`
- Logs stored in `logs/<topic-slug>.log`
- Graceful shutdown via SIGTERM

## Common Tasks

### Adding a New CLI Command

1. Create `src/cli/commands/<command>.js` with exported handler function
2. Import and register in `src/cli/index.js`

### Modifying Scraper Behavior

- **Fetching**: Edit `src/scraper/fetcher.js` (Puppeteer config, timeouts)
- **Parsing**: Edit `src/scraper/parser.js` (DOM selectors for Yad2)
- **Notifications**: Edit `src/scraper/notifier.js` (Telegram messages)

### Config Management

Config functions in `src/config/loader.js`:
- `addProject(project)` - Add new scraper
- `removeProject(topic)` - Remove scraper
- `updateProject(topic, updates)` - Update scraper
- `getProject(topic)` - Get single project
- `getAllProjects()` - Get all projects

## Technical Notes

### Bot Detection

Yad2 uses ShieldSquare (Radware) for bot protection. The scraper bypasses this using:
- `puppeteer-extra` with `puppeteer-extra-plugin-stealth`
- Realistic viewport and headers
- Random delays between actions
- Page scrolling to trigger lazy loading

### DOM Selectors (may change)

Current Yad2 structure uses:
- `[class*="feedItemBox"]` for listing containers
- Images from `img.yad2.co.il` domain as unique identifiers

### Environment Variables

```
TELEGRAM_API_TOKEN - Bot token (required)
TELEGRAM_CHAT_ID - Chat ID (required)
USE_PUPPETEER - Set to 'false' to disable Puppeteer
```

## Testing

```bash
# Run a single scrape without notifications
yad2 run "Topic Name" --silent

# Test CLI help
yad2 --help

# List all scrapers
yad2 scrapers
```

## Dependencies

- `puppeteer-extra` + `puppeteer-extra-plugin-stealth` - Browser automation
- `cheerio` - HTML parsing
- `commander` - CLI framework
- `telenode-js` - Telegram bot API
- `cli-table3` - Table output
- `dotenv` - Environment variables

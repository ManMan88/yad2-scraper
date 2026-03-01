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
| `src/scraper/runner.js` | Continuous runner with jitter, stagger, and 6-hour quiet alerts |
| `src/scraper/requestThrottle.js` | Cross-process request throttle and shared captcha cooldown |
| `src/config/loader.js` | Config loading, saving, and project management |
| `config.json` | Stores scraper configurations (projects array) |

### Process Management

- Scrapers run as detached Node.js processes
- PID files stored in `pids/<topic-slug>.pid`
- Logs stored in `logs/<topic-slug>.log`
- Graceful shutdown via SIGTERM
- Cross-process coordination via shared files in `data/`:
  - `.last-request-ts` — enforces 2-minute minimum gap between any requests
  - `.captcha-cooldown` — shared captcha backoff (all scrapers pause when one is blocked)
- Multiple scrapers get deterministic stagger delays (index * 180s) to avoid simultaneous starts
- Scrape interval uses +/-30% random jitter to prevent predictable patterns

## Common Tasks

### Adding a New CLI Command

1. Create `src/cli/commands/<command>.js` with exported handler function
2. Import and register in `src/cli/index.js`

### Modifying Scraper Behavior

- **Fetching**: Edit `src/scraper/fetcher.js` (Puppeteer config, timeouts, UA rotation, stealth)
- **Parsing**: Edit `src/scraper/parser.js` (DOM selectors for Yad2)
- **Notifications**: Edit `src/scraper/notifier.js` (Telegram messages)
- **Throttling**: Edit `src/scraper/requestThrottle.js` (cross-process rate limiting, captcha backoff)

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
- UA rotation across 9 User-Agent strings (Windows/macOS/Linux) with matching `sec-ch-ua-platform` headers
- Randomized viewport from common desktop resolutions
- Human behavior simulation (mouse movements, smooth scrolling with variable amounts)
- Random delays (3-7s) between actions for natural browsing patterns
- Browser recycling every 8 scrapes to build session history, force-restart on captcha
- Chrome flags to reduce automation detection surface (`--disable-blink-features=AutomationControlled`)
- Cross-process request throttle (2-minute minimum gap between any requests)
- Shared captcha cooldown with exponential backoff (all scrapers back off when one is blocked, capped at 2 hours)
- Deterministic stagger when starting multiple scrapers (index * 180s)
- Interval jitter (+/-30%) to avoid predictable request patterns

### Notification Behavior

- Notifications are only sent when new listings are found (no "no new items" spam)
- "Scan start" message is only included when there are new ads
- 6-hour "still watching" quiet alert when no new listings are found (resets on new ads)
- Listings are kept in history (up to `maxSavedItems`) to prevent re-notifications when Yad2 rotates listings

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

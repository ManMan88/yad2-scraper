# Yad2 Smart Scraper

Scrapes and notifies on new Yad2 items with a minimal setup.

---

Struggling to find a high demand product in Yad2? No problem!
The scraper will scan Yad2 and will find for you the relevant items. Once a new item has been uploaded, it will notify you with a Telegram message.

## Features

- **Bot Management CLI** - Start, stop, and manage scrapers from the command line
- **Puppeteer with Stealth** - Bypasses bot detection using headless Chrome with UA rotation, human behavior simulation, and cross-process request throttling
- **Background Process Management** - Run scrapers as background daemons with interval jitter and staggered starts
- **Telegram Notifications** - Get notified when new items are found (suppresses duplicates, sends 6-hour "still watching" alerts)
- **GitHub Actions Support** - Automated scraping via CI/CD

---

## Quick Start

```bash
# Install dependencies
npm install

# Create a scraper from a Yad2 search URL
yad2 from-url "https://www.yad2.co.il/realestate/forsale?minPrice=1000000" --start

# Or add interactively
yad2 add
```

---

## CLI Commands

### Scraper Management

| Command | Description |
|---------|-------------|
| `yad2 from-url <url>` | Create scraper from Yad2 search URL (auto-names it) |
| `yad2 add` | Interactive wizard to add a new scraper |
| `yad2 remove <topic>` | Remove a scraper (`--cleanup` to delete data) |
| `yad2 edit <topic>` | Edit URL or enable/disable a scraper |

### Process Control

| Command | Description |
|---------|-------------|
| `yad2 start [topic]` | Start scraper(s) as background process |
| `yad2 stop [topic]` | Stop running scraper(s) |
| `yad2 run [topic]` | Run a single scrape (one-shot mode) |

### Monitoring

| Command | Description |
|---------|-------------|
| `yad2 list` | List all scrapers with running status |
| `yad2 scrapers` | List all configured scrapers |
| `yad2 active` | List only running scrapers |
| `yad2 logs <topic>` | View scraper logs (`-f` to follow) |
| `yad2 status <topic>` | Get detailed status for a scraper |

---

## Setup

### 1. Clone and Install

```bash
git clone <repo-url>
cd yad2-scraper
npm install
```

### 2. Configure Telegram

Create a `.env` file with your Telegram credentials:

```bash
cp .env.example .env
# Edit .env with your values:
# TELEGRAM_API_TOKEN=your_bot_token
# TELEGRAM_CHAT_ID=your_chat_id
```

### 3. Add a Scraper

```bash
# Quick way - from a Yad2 search URL
yad2 from-url "https://www.yad2.co.il/realestate/forsale?city=5000&minPrice=2000000"

# Or manually with custom name
yad2 add --topic "Tel Aviv 3 rooms" --url "https://..."
```

### 4. Start Scraping

```bash
# Start in background (runs every 20 minutes)
yad2 start "Tel Aviv 3 rooms"

# Or start all enabled scrapers
yad2 start --all

# View logs
yad2 logs "Tel Aviv 3 rooms" -f
```

---

## GitHub Actions

The scraper can run automatically via GitHub Actions (every 20 minutes, 08:00-20:00).

Add these secrets to your repository:
- `API_TOKEN` - Telegram bot API token
- `CHAT_ID` - Telegram chat ID
- `GIT_CONFIG_EMAIL` - Email for git commits

---

## Configuration

### config.json

```json
{
  "maxSavedItems": 500,
  "projects": [
    {
      "topic": "Tel Aviv Sale",
      "url": "https://www.yad2.co.il/realestate/forsale?...",
      "disabled": false
    }
  ]
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `TELEGRAM_API_TOKEN` | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Telegram chat/user ID |
| `USE_PUPPETEER` | Set to `false` to use fetch instead (may trigger bot detection) |

---

## Project Structure

```
yad2-scraper/
├── src/
│   ├── cli/              # CLI commands
│   │   ├── index.js      # Main CLI entry point
│   │   └── commands/     # Individual command handlers
│   ├── scraper/              # Scraping logic
│   │   ├── fetcher.js        # Puppeteer-based page fetching with stealth
│   │   ├── parser.js         # HTML parsing
│   │   ├── notifier.js       # Telegram notifications
│   │   ├── requestThrottle.js # Cross-process request coordination
│   │   └── storage.js        # Data persistence (with history to prevent re-notifications)
│   └── config/           # Configuration management
├── data/                 # Scraped data (JSON files)
├── logs/                 # Scraper log files
├── pids/                 # PID files for running scrapers
└── config.json           # Scraper configurations
```

---

## License

MIT

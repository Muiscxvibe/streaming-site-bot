# streaming-site-bot

Discord bot that provides admin-only slash commands:

- `/website`: store a base website URL for later scraping.
- `/qbittorrent`: save qBittorrent Web UI host/username/password so downloads can be sent automatically.
- `/go-to`: collect options (headless/use-flaresolverr/type/name/season/episode), build the search URL from the saved base (e.g., `https://example.com/search/all/your-term/`), fetch that page, and list the five healthiest results ordered by health, quality, and sensible file size from the results table. The reply includes download buttons (Download #1, Download #2, etc.); clicking one opens the scraped detail link, extracts the torrent/magnet, and sends it to qBittorrent, then confirms in Discord. There is no separate `/search` command—the scraping runs immediately as part of `/go-to` when you supply search inputs.

Each command streams progress updates back to Discord (and logs to the bot console) so you can see when URLs are validated, search URLs are built, and scraping completes.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file from `.env.example` and populate:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_GUILD_ID` (for registering commands in a development guild)
   - Optional: `FLARESOLVERR_URL` (e.g., `http://localhost:8191`) to enable the FlareSolverr pathway in `/go-to`

## Running the bot
```bash
npm start
```

The bot registers both slash commands on startup for the configured guild and removes any stale guild/global commands that are no longer defined in the code.

## Tests
Jest tests mock the browser launcher and command interactions:
```bash
npm test
```

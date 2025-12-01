# streaming-site-bot

Discord bot that provides two admin-only slash commands:

- `/website`: store a website URL for later browsing.
- `/go-to`: open the stored website on the machine running the bot, with an option to disable headless mode (leaves the window open for you to close) or route through FlareSolverr.

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

The bot registers both slash commands on startup for the configured guild.

## Tests
Jest tests mock the browser launcher and command interactions:
```bash
npm test
```

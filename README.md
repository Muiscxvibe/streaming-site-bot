# streaming-site-bot

Discord bot that provides two slash commands:

- `/website` (admin-only): ask an admin for a website URL and confirm it for later browsing.
- `/go-to`: open the provided website in a headless Chromium instance.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file from `.env.example` and populate:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_GUILD_ID` (for registering commands in a development guild)

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

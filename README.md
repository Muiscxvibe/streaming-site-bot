# streaming-site-bot

Discord bot that provides two admin-only slash commands:

- `/website`: store a website URL for later browsing.
- `/go-to`: open the stored website on the machine running the bot, with an option to disable headless mode.

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

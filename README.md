# streaming-site-bot

A simple Discord bot that stores a website URL via a slash command and opens it in the local browser on request.

## Features
- `/website <url>`: Saves a website URL (automatically adds `https://` if missing and validates HTTP/HTTPS URLs).
- `/go_to`: Opens the saved URL in the machine's default web browser.

Each user's saved URL is stored in memory for their own use.

## Setup
1. Install dependencies:

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Set your Discord bot token in the environment:

   ```bash
   export DISCORD_TOKEN="your-bot-token"
   ```

3. Run the bot:

   ```bash
   python bot.py
   ```

## Notes
- The bot syncs slash commands when it starts. If you add the bot to new servers, it may take a few minutes for commands to appear.
- URLs are validated to ensure they include a host and use `http` or `https`.

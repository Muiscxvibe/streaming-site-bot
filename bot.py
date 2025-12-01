import logging
import os
import re
import webbrowser
from typing import Dict
from urllib.parse import urlparse

import discord
from discord import app_commands

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def _normalize_url(raw_url: str) -> str:
    """Normalize and validate a URL string.

    Adds an ``https://`` scheme if one is missing and ensures the
    URL is http(s).
    """

    url = raw_url.strip()
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", url):
        url = f"https://{url}"

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Please provide a valid http(s) URL.")

    return url


class WebsiteBot(discord.Client):
    def __init__(self) -> None:
        intents = discord.Intents.default()
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)
        self._websites: Dict[int, str] = {}

    async def setup_hook(self) -> None:
        await self.tree.sync()
        logger.info("Slash commands synced.")


bot = WebsiteBot()


@bot.tree.command(name="website", description="Store a website URL to open later.")
@app_commands.describe(url="The website to open with /go_to.")
async def website(interaction: discord.Interaction, url: str) -> None:
    try:
        normalized = _normalize_url(url)
    except ValueError as exc:
        await interaction.response.send_message(str(exc), ephemeral=True)
        return

    bot._websites[interaction.user.id] = normalized
    await interaction.response.send_message(
        f"Saved website: {normalized}\nUse /go_to to open it in the local browser.",
        ephemeral=True,
    )


@bot.tree.command(name="go_to", description="Open your saved website in a browser.")
async def go_to(interaction: discord.Interaction) -> None:
    url = bot._websites.get(interaction.user.id)
    if not url:
        await interaction.response.send_message(
            "No website saved. Use /website first to store a URL.", ephemeral=True
        )
        return

    webbrowser.open(url)
    await interaction.response.send_message(
        f"Opening {url} in the local browser.", ephemeral=True
    )


def main() -> None:
    token = os.getenv("DISCORD_TOKEN")
    if not token:
        raise RuntimeError("Set the DISCORD_TOKEN environment variable before running the bot.")

    bot.run(token)


if __name__ == "__main__":
    main()

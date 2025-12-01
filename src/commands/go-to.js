const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { openWebsite } = require('../services/browser');
const { openWithFlareSolverr } = require('../services/flaresolverr');
const { getWebsite } = require('../services/websiteStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('go-to')
    .setDescription('Open the saved website in a browser')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption((option) =>
      option
        .setName('headless')
        .setDescription('Run the browser in headless mode (default: true)')
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName('use-flaresolverr')
        .setDescription('Route through FlareSolverr to bypass human verification (requires FLARESOLVERR_URL)')
        .setRequired(false),
    ),
  async execute(interaction) {
    const storedWebsite = getWebsite();

    if (!storedWebsite) {
      await interaction.reply({
        content: 'No website saved yet. Use /website to set one first.',
        ephemeral: true,
      });
      return;
    }

    const useFlareSolverr = interaction.options?.getBoolean('use-flaresolverr') ?? false;
    const headless = interaction.options?.getBoolean('headless') ?? true;

    try {
      if (useFlareSolverr) {
        const { url, endpoint } = await openWithFlareSolverr(storedWebsite);
        await interaction.reply({
          content: `Opened ${url} via FlareSolverr (${endpoint}).`,
          ephemeral: true,
        });
      } else {
        const normalized = await openWebsite(storedWebsite, headless);
        const modeLabel = headless ? 'in a headless browser' : 'with headless mode disabled';
        await interaction.reply({
          content: `Opened ${normalized} ${modeLabel}.`,
          ephemeral: true,
        });
      }
    } catch (error) {
      await interaction.reply({
        content: `Could not open that URL: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};

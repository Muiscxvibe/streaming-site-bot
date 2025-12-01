const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const storedWebsite = getWebsite();

    if (!storedWebsite) {
      await interaction.editReply('No website saved yet. Use /website to set one first.');
      return;
    }

    const useFlareSolverr = interaction.options?.getBoolean('use-flaresolverr') ?? false;
    const headless = interaction.options?.getBoolean('headless') ?? true;
    const modeLabel = headless
      ? 'in a headless browser'
      : 'with headless mode disabled. The window will stay open until you close it.';

    try {
      if (useFlareSolverr) {
        const { url, endpoint } = await openWithFlareSolverr(storedWebsite);
        const normalized = await openWebsite(url, headless);
        await interaction.editReply(`Opened ${normalized} via FlareSolverr (${endpoint}) ${modeLabel}`);
      } else {
        const normalized = await openWebsite(storedWebsite, headless);
        await interaction.editReply(`Opened ${normalized} ${modeLabel}`);
      }
    } catch (error) {
      await interaction.editReply(`Could not open that URL: ${error.message}`);
    }
  },
};

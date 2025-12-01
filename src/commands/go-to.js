const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { openWebsite } = require('../services/browser');
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

    const headless = interaction.options?.getBoolean('headless') ?? true;

    try {
      const normalized = await openWebsite(storedWebsite, headless);
      const modeLabel = headless ? 'in a headless browser' : 'with headless mode disabled';
      await interaction.reply({
        content: `Opened ${normalized} ${modeLabel}.`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `Could not open that URL: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};

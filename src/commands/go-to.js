const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { openWebsite } = require('../services/browser');
const { getWebsite } = require('../services/websiteStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('go-to')
    .setDescription('Open the saved website in a headless browser')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const storedWebsite = getWebsite();

    if (!storedWebsite) {
      await interaction.reply({
        content: 'No website saved yet. Use /website to set one first.',
        ephemeral: true,
      });
      return;
    }

    try {
      const normalized = await openWebsite(storedWebsite);
      await interaction.reply({
        content: `Opened ${normalized} in a headless browser.`,
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

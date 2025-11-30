const { SlashCommandBuilder } = require('discord.js');
const { openWebsite } = require('../services/browser');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('go-to')
    .setDescription('Open a website in a headless browser')
    .addStringOption((option) =>
      option
        .setName('url')
        .setDescription('Website to browse')
        .setRequired(true),
    ),
  async execute(interaction) {
    const urlInput = interaction.options.getString('url', true);

    try {
      const normalized = await openWebsite(urlInput);
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

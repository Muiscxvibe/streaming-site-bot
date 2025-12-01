const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { ensureUrl } = require('../services/browser');
const { setWebsite } = require('../services/websiteStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('website')
    .setDescription('Admin-only command to capture a website target for browsing')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('url')
        .setDescription('Website to visit later')
        .setRequired(true),
    ),
  async execute(interaction) {
    const urlInput = interaction.options.getString('url', true);
    const normalized = ensureUrl(urlInput);
    setWebsite(normalized);

    await interaction.reply({
      content: `Saved website: ${normalized}. Use /go-to to open it on the bot machine.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

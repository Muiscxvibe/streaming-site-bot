const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { ensureUrl } = require('../services/browser');
const { setWebsite } = require('../services/websiteStore');
const { createProgressTracker } = require('../services/progress');

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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const progress = createProgressTracker({ interaction, scope: 'website' });

    try {
      const urlInput = interaction.options.getString('url', true);
      await progress.info('Validating website URL...');

      const normalized = ensureUrl(urlInput);
      setWebsite(normalized);

      await progress.complete(`Saved website: ${normalized}. Use /go-to to open it on the bot machine.`);
    } catch (error) {
      console.error('[website] Failed to save URL', error);
      await progress.fail(`Could not save that URL: ${error.message}`);
    }
  },
};

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createProgressTracker } = require('../services/progress');
const { setQbittorrentConfig } = require('../services/qbittorrent');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('qbittorrent')
    .setDescription('Configure qBittorrent connection for downloads (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option.setName('host').setDescription('qBittorrent Web UI host (e.g. http://localhost:8080)').setRequired(true),
    )
    .addStringOption((option) => option.setName('username').setDescription('qBittorrent username').setRequired(true))
    .addStringOption((option) => option.setName('password').setDescription('qBittorrent password').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const progress = createProgressTracker({ interaction, scope: 'qbittorrent' });

    try {
      const host = interaction.options.getString('host');
      const username = interaction.options.getString('username');
      const password = interaction.options.getString('password');

      await progress.info('Saving qBittorrent connection details...');
      setQbittorrentConfig(host, username, password);
      await progress.success('qBittorrent connection saved. The bot will log in automatically when downloading.');
      await progress.complete();
    } catch (error) {
      console.error('[qbittorrent] Failed to save configuration', error);
      await progress.fail(error.message);
    }
  },
};

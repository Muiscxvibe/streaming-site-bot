const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { setSavePath, getSavePaths } = require('../services/savePathStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-path')
    .setDescription('Set the save path for shows or movies (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Whether to store shows or movies in this path')
        .setRequired(true)
        .addChoices({ name: 'show', value: 'show' }, { name: 'movie', value: 'movie' }),
    )
    .addStringOption((option) =>
      option
        .setName('path')
        .setDescription('Absolute path where downloads should be saved')
        .setRequired(true),
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const type = interaction.options.getString('type');
    const path = interaction.options.getString('path');

    try {
      setSavePath(type, path);
      const { show, movie } = getSavePaths();
      await interaction.editReply(
        `✅ Saved paths updated.\n• Shows: ${show}\n• Movies: ${movie}`,
      );
    } catch (error) {
      console.error('[set-path] Failed to update save path', error);
      await interaction.editReply(`❌ Could not save path: ${error.message}`);
    }
  },
};

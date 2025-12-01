const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

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
    const url = interaction.options.getString('url', true);
    await interaction.reply({
      content: `Saved website: ${url}. Use /go-to to open it in a headless browser.`,
      ephemeral: true,
    });
  },
};

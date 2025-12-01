const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getActivePage } = require('../services/browser');
const { runSearch } = require('../services/search');

function buildSearchTerm(type, name, season, episode) {
  if (type === 'show') {
    if (season == null || episode == null) {
      throw new Error('Season and episode are required for shows.');
    }

    const paddedSeason = String(season).padStart(2, '0');
    const paddedEpisode = String(episode).padStart(2, '0');
    return `${name} s${paddedSeason}e${paddedEpisode}`;
  }

  return name;
}

function formatResults(results, term) {
  if (!results.length) {
    return `No matching results were found for "${term}".`;
  }

  const lines = results.map((result, index) => {
    const quality = result.quality ? result.quality.toUpperCase() : 'Unknown quality';
    const size = result.sizeText || 'Unknown size';
    const health = result.health ? `${result.health} health/seed score` : 'Unknown health';

    return `${index + 1}. ${result.name} — Quality: ${quality}; Size: ${size}; Health: ${health}`;
  });

  return [
    'Top matches ordered by health, quality, then smaller sizes:',
    ...lines,
    'Results are ordered best to worst based on health, quality, and reasonable size.',
  ].join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search the current site for a movie or show')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Is this a movie or a show?')
        .setRequired(true)
        .addChoices({ name: 'movie', value: 'movie' }, { name: 'show', value: 'show' }),
    )
    .addStringOption((option) => option.setName('name').setDescription('Title of the media').setRequired(true))
    .addIntegerOption((option) =>
      option.setName('season').setDescription('Season number (required for shows)').setRequired(false),
    )
    .addIntegerOption((option) =>
      option.setName('episode').setDescription('Episode number (required for shows)').setRequired(false),
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const page = getActivePage();

    if (!page) {
      await interaction.editReply('No active browser session found. Run /go-to first to load the site.');
      return;
    }

    const type = interaction.options?.getString('type');
    const name = interaction.options?.getString('name');
    const season = interaction.options?.getInteger('season');
    const episode = interaction.options?.getInteger('episode');

    try {
      const searchTerm = buildSearchTerm(type, name, season, episode);
      const results = await runSearch(page, searchTerm);
      const message = formatResults(results, searchTerm);
      await interaction.editReply(message);
    } catch (error) {
      await interaction.editReply(`Could not perform the search: ${error.message}`);
    }
  },
};

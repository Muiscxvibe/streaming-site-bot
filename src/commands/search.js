const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { ensureActivePage } = require('../services/browser');
const { runSearch } = require('../services/search');
const { createProgressTracker } = require('../services/progress');

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

    const progress = createProgressTracker({ interaction, scope: 'search' });
    await progress.info('Starting search flow...');

    const { page, revived } = await ensureActivePage();

    if (!page) {
      await progress.fail('No active browser session found. Run /go-to first to load the site.');
      return;
    }

    if (revived) {
      await progress.info('Recovered the active browser page.');
    }

    await progress.success('Browser session ready.');

    const type = interaction.options?.getString('type');
    const name = interaction.options?.getString('name');
    const season = interaction.options?.getInteger('season');
    const episode = interaction.options?.getInteger('episode');

    try {
      const searchTerm = buildSearchTerm(type, name, season, episode);
      await progress.info(`Searching for "${searchTerm}"...`);
      const results = await runSearch(page, searchTerm, (step) => progress.info(step));
      await progress.success(`Search finished with ${results.length} result(s).`);

      const message = formatResults(results, searchTerm);
      await progress.complete(message);
    } catch (error) {
      console.error('[search] Could not perform the search', error);
      await progress.fail(`Could not perform the search: ${error.message}`);
    }
  },
};

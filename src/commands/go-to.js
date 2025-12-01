const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getWebsite } = require('../services/websiteStore');
const { createProgressTracker } = require('../services/progress');
const { buildSearchTerm, formatResults, runSearch, buildSearchUrl } = require('../services/search');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('go-to')
    .setDescription('Build a search URL from the saved website and list the best matches')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption((option) =>
      option
        .setName('headless')
        .setDescription('Run the browser in headless mode (default: true)')
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName('use-flaresolverr')
        .setDescription('Route through FlareSolverr to bypass human verification (requires FLARESOLVERR_URL)')
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Search type (movie or show). Provide name to trigger a search.')
        .setRequired(false)
        .addChoices({ name: 'movie', value: 'movie' }, { name: 'show', value: 'show' }),
    )
    .addStringOption((option) =>
      option.setName('name').setDescription('Title to search for (triggers search when provided)').setRequired(false),
    )
    .addIntegerOption((option) =>
      option.setName('season').setDescription('Season number (required for shows)').setRequired(false),
    )
    .addIntegerOption((option) =>
      option.setName('episode').setDescription('Episode number (required for shows)').setRequired(false),
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const progress = createProgressTracker({ interaction, scope: 'go-to' });
    await progress.info('Preparing to build the search URL from the saved website...');

    const storedWebsite = getWebsite();

    if (!storedWebsite) {
      await progress.fail('No website saved yet. Use /website to set one first.');
      return;
    }

    await progress.success(`Saved website found: ${storedWebsite}`);

    const useFlareSolverr = interaction.options?.getBoolean('use-flaresolverr') ?? false;
    const headless = interaction.options?.getBoolean('headless') ?? true;
    const searchType = interaction.options?.getString('type');
    const searchName = interaction.options?.getString('name');
    const season = interaction.options?.getInteger('season');
    const episode = interaction.options?.getInteger('episode');

    try {
      const searchTerm = buildSearchTerm(searchType, searchName, season, episode);
      const searchUrl = buildSearchUrl(storedWebsite, searchTerm);

      await progress.info(`Using options — headless: ${headless}, flaresolverr: ${useFlareSolverr}`);
      await progress.info(`Searching for "${searchTerm}" at ${searchUrl}`);

      const { results, searchUrl: fetchedUrl } = await runSearch(
        searchTerm,
        storedWebsite,
        (step) => progress.info(step),
        { useFlareSolverr },
      );

      await progress.success(`Search finished via ${fetchedUrl} with ${results.length} result(s).`);

      const message = formatResults(results, searchTerm);
      await progress.complete(message);
    } catch (error) {
      console.error('[go-to] Failed to perform search', error);
      await progress.fail(`Could not complete the request: ${error.message}`);
    }
  },
};

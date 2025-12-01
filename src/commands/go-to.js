const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { openWebsite, ensureActivePage } = require('../services/browser');
const { openWithFlareSolverr } = require('../services/flaresolverr');
const { getWebsite } = require('../services/websiteStore');
const { createProgressTracker } = require('../services/progress');
const { buildSearchTerm, formatResults, runSearch } = require('../services/search');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('go-to')
    .setDescription('Open the saved website and optionally search it')
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
    await progress.info('Preparing to open the saved website...');

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
    const modeLabel = headless
      ? 'in a headless browser'
      : 'with headless mode disabled. The window will stay open until you close it.';

    try {
      if (useFlareSolverr) {
        await progress.info('Requesting FlareSolverr to bypass verification...');
        const { url, endpoint } = await openWithFlareSolverr(storedWebsite);
        await progress.success(`FlareSolverr resolved the page via ${endpoint}`);

        await progress.info('Opening resolved page in browser...');
        const normalized = await openWebsite(url, headless);
        await progress.complete(`Opened ${normalized} via FlareSolverr (${endpoint}) ${modeLabel}`);
      } else {
        await progress.info('Opening saved page in browser...');
        const normalized = await openWebsite(storedWebsite, headless);
        await progress.complete(`Opened ${normalized} ${modeLabel}`);
      }

      const wantsSearch = Boolean(searchType || searchName || season != null || episode != null);

      if (!wantsSearch) {
        return;
      }

      await progress.info('Preparing to search the opened site...');

      const { page, revived } = await ensureActivePage();

      if (!page) {
        await progress.fail('No active browser session found. Run /go-to again to load the site.');
        return;
      }

      if (revived) {
        await progress.info('Recovered the active browser page.');
      }

      await progress.success('Browser session ready.');

      const searchTerm = buildSearchTerm(searchType, searchName, season, episode);
      await progress.info(`Searching for "${searchTerm}"...`);
      const results = await runSearch(page, searchTerm, (step) => progress.info(step));
      await progress.success(`Search finished with ${results.length} result(s).`);

      const message = formatResults(results, searchTerm);
      await progress.complete(message);
    } catch (error) {
      console.error('[go-to] Failed to open site', error);
      await progress.fail(`Could not complete the request: ${error.message}`);
    }
  },
};

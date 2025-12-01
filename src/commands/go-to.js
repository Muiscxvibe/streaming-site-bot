const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { openWebsite } = require('../services/browser');
const { openWithFlareSolverr } = require('../services/flaresolverr');
const { getWebsite } = require('../services/websiteStore');
const { createProgressTracker } = require('../services/progress');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('go-to')
    .setDescription('Open the saved website in a browser')
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
    } catch (error) {
      console.error('[go-to] Failed to open site', error);
      await progress.fail(`Could not open that URL: ${error.message}`);
    }
  },
};

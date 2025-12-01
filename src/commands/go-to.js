const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const { getWebsite } = require('../services/websiteStore');
const { createProgressTracker } = require('../services/progress');
const { buildSearchTerm, runSearch } = require('../services/search');
const { saveResults } = require('../services/resultStore');
const { isConfigured } = require('../services/qbittorrent');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('go-to')
    .setDescription('Build a search URL from the saved website and list the best matches')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption((option) =>
        option
          .setName('headless')
          .setDescription('Run the browser in headless mode (default: false)')
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
    const headless = interaction.options?.getBoolean('headless') ?? false;
    const searchType = interaction.options?.getString('type');
    const searchName = interaction.options?.getString('name');
    const season = interaction.options?.getInteger('season');
    const episode = interaction.options?.getInteger('episode');

    try {
      const searchTerm = buildSearchTerm(searchType, searchName, season, episode);
      await progress.info(`Using options — headless: ${headless}, flaresolverr: ${useFlareSolverr}`);
      await progress.info(`Searching for "${searchTerm}" at the saved site`);

      const { results, searchUrl: fetchedUrl } = await runSearch(searchTerm, storedWebsite, (step) => progress.info(step), {
        useFlareSolverr,
      });

      await progress.success(`Search finished via ${fetchedUrl} with ${results.length} result(s).`);
      const qbNote = isConfigured()
        ? ''
        : '\n⚠️ qBittorrent is not configured yet. Use /qbittorrent before pressing download buttons.';

      if (!results.length) {
        const content = `${progress.getSteps().join('\n')}\n\nNo matching results were found for "${searchTerm}".${qbNote}`;
        await interaction.editReply({ content, components: [] });
        return;
      }

      const token = saveResults(results, { useFlareSolverr, baseUrl: storedWebsite, searchType });
      const buttons = results.map((result, index) =>
        new ButtonBuilder()
          .setCustomId(`download:${token}:${index}`)
          .setLabel(`Download #${index + 1}`)
          .setStyle(ButtonStyle.Success),
      );

      const rows = [];
      for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
      }

      const embed = new EmbedBuilder()
        .setTitle('Search results')
        .setDescription(`Query: **${searchTerm}**`)
        .setColor(0x00ae86)
        .addFields(
          results.map((result, index) => {
            const quality = result.quality ? result.quality.toUpperCase() : 'Unknown quality';
            const size = result.sizeText || 'Unknown size';
            const health = result.health ? `${result.health} health/seed score` : 'Unknown health';

            return {
              name: `${index + 1}. ${result.name}`,
              value: `**Quality:** ${quality}\n**Size:** ${size}\n**Health:** ${health}`,
              inline: false,
            };
          }),
        )
        .setFooter({ text: 'Top matches ordered by health, quality, then smaller sizes.' });

      const content = `${progress.getSteps().join('\n')}\n\nShowing the best matches below.${qbNote}`;
      await interaction.editReply({ content, embeds: [embed], components: rows });
    } catch (error) {
      console.error('[go-to] Failed to perform search', error);
      await progress.fail(`Could not complete the request: ${error.message}`);
    }
  },
};

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { randomUUID } = require('node:crypto');
const { getWebsite } = require('../services/websiteStore');
const { runSearch, buildSearchTerm, fetchDetailPage, extractDownloadLink } = require('../services/search');
const { saveResults } = require('../services/resultStore');
const { isConfigured, addTorrent } = require('../services/qbittorrent');
const { createProgressTracker } = require('../services/progress');
const { autocorrectTitle, fetchShowSeasonCount } = require('../services/autocorrect');
const { getSavePathForType } = require('../services/savePathStore');
const { startDownloadProgress } = require('../services/downloadProgress');

const sessions = new Map();

function createSession(userId) {
  const id = randomUUID();
  const session = {
    id,
    userId,
    type: null,
    name: null,
    originalName: null,
    season: null,
    episode: null,
    corrected: null,
    seasonCount: null,
    scope: null,
    requestedAllSeasons: false,
  };
  sessions.set(id, session);
  return session;
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function ensureSessionOwner(interaction, session) {
  if (session.userId !== interaction.user.id) {
    interaction.reply({
      content: 'This setup belongs to another user. Please run /go-to to start your own.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
}

function mediaTypeButtons(sessionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`goto:type:${sessionId}:show`).setLabel('Show').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`goto:type:${sessionId}:movie`).setLabel('Movie').setStyle(ButtonStyle.Primary),
  );
}

function correctionButtons(sessionId, corrected) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`goto:confirm:${sessionId}:yes`).setLabel(`Yes — ${corrected}`).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`goto:confirm:${sessionId}:no`).setLabel('No, keep my entry').setStyle(ButtonStyle.Secondary),
  );
}

function scopeButtons(session) {
  const buttons = [];

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`goto:scope:${session.id}:episode`)
      .setLabel('Download episode')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(session.episode == null),
  );

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`goto:scope:${session.id}:season`)
      .setLabel('Download season pack')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(session.season == null),
  );

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`goto:scope:${session.id}:all`)
      .setLabel(
        session.seasonCount ? `Download all seasons (${session.seasonCount})` : 'Download all seasons (search)'
      )
      .setStyle(ButtonStyle.Success)
      .setDisabled(!session.seasonCount),
  );

  return new ActionRowBuilder().addComponents(buttons);
}

function buildSummaryEmbed(session, title = 'Search setup') {
  const embed = new EmbedBuilder().setTitle(title).setColor(0x5865f2);

  embed.addFields({ name: 'Type', value: session.type || 'Select media type', inline: true });

  if (session.type === 'show') {
    embed.addFields({
      name: 'Show details',
      value:
        session.name && (session.requestedAllSeasons || session.season != null)
          ? `${session.name} — ${
              session.requestedAllSeasons
                ? 'All seasons'
                : `S${String(session.season).padStart(2, '0')}${
                    session.episode != null ? `E${String(session.episode).padStart(2, '0')}` : ' (full season)'
                  }`
            }`
          : 'Enter show name and season (episode optional)',
    });

    embed.addFields({
      name: 'Scope',
      value: session.scope ? session.scope : 'Choose episode/season/all seasons',
    });

    if (session.seasonCount) {
      embed.addFields({ name: 'Detected seasons', value: String(session.seasonCount), inline: true });
    }
  } else if (session.type === 'movie') {
    embed.addFields({ name: 'Movie', value: session.name || 'Enter movie name' });
  }

  return embed;
}

function buildResultEmbed(searchTerm, results) {
  return new EmbedBuilder()
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
    .setFooter({ text: 'Ordered by smallest size, then quality, then health.' });
}

function buildDownloadRows(token, results) {
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
  return rows;
}

async function promptScopeSelection(interaction, session, { useUpdate = false } = {}) {
  const payload = {
    content: session.seasonCount
      ? `Detected ${session.seasonCount} season(s). Choose what to download.`
      : 'Choose what to download.',
    embeds: [buildSummaryEmbed(session, 'Confirm scope')],
    components: [scopeButtons(session)],
    flags: MessageFlags.Ephemeral,
  };

  if (useUpdate && interaction.update) {
    await interaction.update(payload);
  } else {
    await interaction.reply(payload);
  }
}

async function promptCorrection(interaction, session, correctedTitle) {
  await interaction.reply({
    content: `Did you mean **${correctedTitle}**?`,
    embeds: [buildSummaryEmbed(session, 'Confirm title correction')],
    components: [correctionButtons(session.id, correctedTitle)],
    flags: MessageFlags.Ephemeral,
  });
}

async function resolveSeasonCount(session, storedWebsite, progress) {
  if (session.seasonCount && session.seasonCount > 0) {
    return session.seasonCount;
  }

  await progress.info('Detecting how many seasons are available...');
  const googleCount = await fetchShowSeasonCount(session.name);

  if (googleCount && googleCount > 0) {
    session.seasonCount = googleCount;
    await progress.success(`Detected ${googleCount} season(s) via Google.`);
    return googleCount;
  }

  await progress.info('Season count unknown. Probing the site season by season...');
  let discovered = 0;

  for (let seasonNumber = 1; seasonNumber <= 20; seasonNumber += 1) {
    const searchTerm = buildSearchTerm('show', session.name, seasonNumber, null);
    const { results } = await runSearch(searchTerm, storedWebsite, () => {}, { useFlareSolverr: false });

    if (results.length) {
      discovered = seasonNumber;
      await progress.info(`Found matches for season ${seasonNumber} while probing.`);
    } else if (discovered > 0) {
      break;
    }
  }

  if (discovered > 0) {
    session.seasonCount = discovered;
    await progress.success(`Detected ${discovered} season(s) by probing search results.`);
    return discovered;
  }

  await progress.info('Could not determine season count after probing.');
  return null;
}

async function runFinalSearch(interaction, session) {
  const storedWebsite = getWebsite();

  if (!storedWebsite) {
    await interaction.reply({
      content: 'No website saved yet. Use /website to set one first.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const progress = createProgressTracker({ interaction, scope: 'go-to' });
  await progress.info('Preparing to build the search URL from the saved website...');
  await progress.success(`Saved website found: ${storedWebsite}`);

  const qbNote = isConfigured()
    ? ''
    : '\n⚠️ qBittorrent is not configured yet. Use /qbittorrent before pressing download buttons.';

  if (session.scope === 'all') {
    const resolvedCount = await resolveSeasonCount(session, storedWebsite, progress);

    if (!resolvedCount || resolvedCount < 1) {
      await progress.fail('Could not determine how many seasons to download.');
      return;
    }

    if (!isConfigured()) {
      await progress.fail('qBittorrent is not configured. Use /qbittorrent before bulk season downloads.');
      return;
    }

    const savePath = getSavePathForType('show');

    for (let seasonNumber = 1; seasonNumber <= resolvedCount; seasonNumber += 1) {
      const searchTerm = buildSearchTerm('show', session.name, seasonNumber, null);
      await progress.info(`Searching for season ${seasonNumber}: "${searchTerm}" at the saved site`);

      const { results, searchUrl: fetchedUrl } = await runSearch(
        searchTerm,
        storedWebsite,
        (step) => progress.info(step),
        {
          useFlareSolverr: false,
        },
      );

      await progress.success(`Season ${seasonNumber} search finished via ${fetchedUrl} with ${results.length} result(s).`);

      if (!results.length) {
        await progress.info(`No results found for season ${seasonNumber}. Skipping.`);
        continue;
      }

      const best = results[0];
      await progress.info(`Opening detail page for best season ${seasonNumber} match: "${best.name}"...`);
      const { html, url } = await fetchDetailPage(best.detailUrl, { useFlareSolverr: false });
      await progress.success(`Fetched detail page from ${url}`);

      const downloadUrl = extractDownloadLink(html, url);

      if (!downloadUrl) {
        await progress.info(`No download link found for season ${seasonNumber}.`);
        continue;
      }

      if (savePath) {
        await progress.info(`Sending to qBittorrent at path: ${savePath}`);
      } else {
        await progress.info('Sending to qBittorrent...');
      }

      const tag = `goto-${session.id}-s${seasonNumber}`;
      await addTorrent(downloadUrl, { savePath, tag });
      await progress.success(`qBittorrent accepted the season ${seasonNumber} download.`);
      await startDownloadProgress(interaction, { tag, displayName: `${session.name} — Season ${seasonNumber}` });
    }

    await progress.complete(`Finished processing ${resolvedCount} season(s).`);
    return;
  }

  const searchTerm = buildSearchTerm(session.type, session.name, session.season, session.scope === 'episode' ? session.episode : null);
  await progress.info(`Searching for "${searchTerm}" at the saved site`);

  const { results, searchUrl: fetchedUrl } = await runSearch(searchTerm, storedWebsite, (step) => progress.info(step), {
    useFlareSolverr: false,
  });

  await progress.success(`Search finished via ${fetchedUrl} with ${results.length} result(s).`);

  if (!results.length) {
    const content = `${progress.getSteps().join('\n')}\n\nNo matching results were found for "${searchTerm}".${qbNote}`;
    await interaction.editReply({ content, components: [] });
    return;
  }

  const token = saveResults(results, {
    useFlareSolverr: false,
    baseUrl: storedWebsite,
    searchType: session.type,
  });

  const content = `${progress.getSteps().join('\n')}\n\nShowing the best matches below.${qbNote}`;
  await interaction.editReply({ content, embeds: [buildResultEmbed(searchTerm, results)], components: buildDownloadRows(token, results) });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('go-to')
    .setDescription('Interactively search the saved website and download results')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const storedWebsite = getWebsite();
    const session = createSession(interaction.user.id);
    await interaction.reply({
      content: storedWebsite
        ? 'Select a media type to begin your interactive search.'
        : 'No website saved yet. Use /website to set one first.',
      embeds: [buildSummaryEmbed(session)],
      components: storedWebsite ? [mediaTypeButtons(session.id)] : [],
      flags: MessageFlags.Ephemeral,
    });
  },

  async handleButton(interaction) {
    if (!interaction.customId.startsWith('goto:')) return false;
    const [, step, sessionId, value] = interaction.customId.split(':');
    const session = getSession(sessionId);
    if (!session) {
      await interaction.reply({ content: 'This setup expired. Run /go-to to start again.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (!ensureSessionOwner(interaction, session)) return true;

    if (step === 'type') {
      session.type = value;
      const modal = new ModalBuilder()
        .setCustomId(`goto-modal:${value}:${session.id}`)
        .setTitle(value === 'show' ? 'Show details' : 'Movie details');

      const nameInput = new TextInputBuilder()
        .setCustomId('name')
        .setLabel(value === 'show' ? 'Show name' : 'Movie name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      if (value === 'show') {
        const seasonInput = new TextInputBuilder()
          .setCustomId('season')
          .setLabel('Season number')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        const episodeInput = new TextInputBuilder()
          .setCustomId('episode')
          .setLabel('Episode number')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(seasonInput), new ActionRowBuilder().addComponents(episodeInput));
      } else {
        modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
      }

      await interaction.showModal(modal);
      return true;
    }

    if (step === 'confirm') {
      if (value === 'yes' && session.corrected) {
        session.name = session.corrected;
        session.seasonCount = session.type === 'show' ? await fetchShowSeasonCount(session.name) : session.seasonCount;
      } else if (value === 'no' && session.originalName) {
        session.name = session.originalName;
        session.seasonCount = session.type === 'show' ? await fetchShowSeasonCount(session.name) : session.seasonCount;
      }

      session.corrected = null;

      if (session.type === 'show') {
        if (session.requestedAllSeasons) {
          await interaction.update({
            content: 'Downloading all detected seasons with your selections...',
            components: [],
            embeds: [buildSummaryEmbed(session, 'Searching...')],
          });
          await runFinalSearch(interaction, session);
        } else {
          await promptScopeSelection(interaction, session, { useUpdate: true });
        }
      } else {
        await interaction.update({ content: 'Searching with your selections...', components: [], embeds: [buildSummaryEmbed(session, 'Searching...')] });
        await runFinalSearch(interaction, session);
      }
      return true;
    }

    if (step === 'scope') {
      if (value === 'episode' && session.episode == null) {
        await interaction.reply({
          content: 'Episode number is required to download a single episode.',
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      if (value === 'season' && session.season == null) {
        await interaction.reply({ content: 'Season number is required to download a season.', flags: MessageFlags.Ephemeral });
        return true;
      }

      if (value === 'all' && !session.seasonCount) {
        await interaction.reply({
          content: 'Could not detect how many seasons this show has. Please provide at least one season number.',
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      session.scope = value === 'all' ? 'all' : value;

      await interaction.update({ content: 'Searching with your selections...', components: [], embeds: [buildSummaryEmbed(session, 'Searching...')] });
      await runFinalSearch(interaction, session);
      return true;
    }

    return true;
  },

  async handleModal(interaction) {
    if (!interaction.customId.startsWith('goto-modal:')) return false;
    const [, type, sessionId] = interaction.customId.split(':');
    const session = getSession(sessionId);
    if (!session) {
      await interaction.reply({ content: 'This setup expired. Run /go-to to start again.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (!ensureSessionOwner(interaction, session)) return true;

    const rawName = interaction.fields.getTextInputValue('name');
    session.type = type;
    if (type === 'show') {
      const rawSeason = interaction.fields.getTextInputValue('season');
      const parsedSeason = Number.parseInt(rawSeason, 10);
      const requestedAll = rawSeason.trim().toLowerCase() === 'all';
      session.requestedAllSeasons = requestedAll;
      session.season = requestedAll || Number.isNaN(parsedSeason) ? null : parsedSeason;
      const parsedEpisode = Number.parseInt(interaction.fields.getTextInputValue('episode'), 10);
      session.episode = Number.isNaN(parsedEpisode) ? null : parsedEpisode;

      if (!requestedAll && session.season == null) {
        await interaction.reply({
          content: 'Please provide a season number or "all" to continue.',
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }
    }

    const correction = await autocorrectTitle(rawName);
    session.originalName = correction.original;
    session.name = correction.corrected;
    session.corrected = correction.corrected !== correction.original ? correction.corrected : null;

    if (type === 'show') {
      session.scope = session.requestedAllSeasons
        ? 'all'
        : session.episode != null
          ? 'episode'
          : session.season != null
            ? 'season'
            : 'all';
      session.seasonCount = await fetchShowSeasonCount(session.name);

      if (session.corrected) {
        await interaction.reply({
          content: `We found a possible title fix. Did you mean **${session.corrected}**?`,
          embeds: [buildSummaryEmbed(session, 'Confirm search')],
          components: [correctionButtons(session.id, session.corrected)],
          flags: MessageFlags.Ephemeral,
        });
      } else {
        if (session.requestedAllSeasons) {
          await interaction.reply({
            content: 'Downloading all detected seasons with your selections...',
            embeds: [buildSummaryEmbed(session, 'Searching...')],
            components: [],
            flags: MessageFlags.Ephemeral,
          });
          await runFinalSearch(interaction, session);
        } else {
          await promptScopeSelection(interaction, session);
        }
      }
    } else {
      session.scope = 'movie';
      await interaction.reply({
        content: session.corrected
          ? `We found a possible title fix. Did you mean **${session.corrected}**?`
          : 'Ready to search with your entry. Click below to proceed.',
        embeds: [buildSummaryEmbed(session, 'Confirm search')],
        components: session.corrected
          ? [correctionButtons(session.id, session.corrected)]
          : [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`goto:confirm:${session.id}:yes`).setLabel('Search now').setStyle(ButtonStyle.Success))],
        flags: MessageFlags.Ephemeral,
      });

      if (!session.corrected) {
        await runFinalSearch(interaction, session);
      }
    }

    return true;
  },

  __sessionStore: sessions,
};

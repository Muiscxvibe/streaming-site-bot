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
const { runSearch, buildSearchTerm } = require('../services/search');
const { saveResults } = require('../services/resultStore');
const { isConfigured } = require('../services/qbittorrent');
const { createProgressTracker } = require('../services/progress');
const { autocorrectTitle } = require('../services/autocorrect');

const sessions = new Map();

function createSession(userId) {
  const id = randomUUID();
  const session = {
    id,
    userId,
    headless: null,
    useFlareSolverr: null,
    type: null,
    name: null,
    season: null,
    episode: null,
    corrected: null,
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

function headlessButtons(sessionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`goto:headless:${sessionId}:true`).setLabel('Headless: true').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`goto:headless:${sessionId}:false`).setLabel('Headless: false').setStyle(ButtonStyle.Secondary),
  );
}

function flaresolverrButtons(sessionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`goto:flaresolverr:${sessionId}:true`)
      .setLabel('Use FlareSolverr: true')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`goto:flaresolverr:${sessionId}:false`)
      .setLabel('Use FlareSolverr: false')
      .setStyle(ButtonStyle.Secondary),
  );
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

function buildSummaryEmbed(session, title = 'Search setup') {
  const embed = new EmbedBuilder().setTitle(title).setColor(0x5865f2);

  embed.addFields(
    { name: 'Headless', value: session.headless === null ? 'Choose an option' : String(session.headless), inline: true },
    {
      name: 'Use FlareSolverr',
      value: session.useFlareSolverr === null ? 'Choose an option' : String(session.useFlareSolverr),
      inline: true,
    },
    { name: 'Type', value: session.type || 'Select media type', inline: true },
  );

  if (session.type === 'show') {
    embed.addFields({
      name: 'Show details',
      value:
        session.name && session.season != null && session.episode != null
          ? `${session.name} — S${String(session.season).padStart(2, '0')}E${String(session.episode).padStart(2, '0')}`
          : 'Enter show name, season, and episode',
    });
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

async function promptCorrection(interaction, session, correctedTitle) {
  await interaction.reply({
    content: `Did you mean **${correctedTitle}**?`,
    embeds: [buildSummaryEmbed(session, 'Confirm title correction')],
    components: [correctionButtons(session.id, correctedTitle)],
    flags: MessageFlags.Ephemeral,
  });
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

  const searchTerm = buildSearchTerm(session.type, session.name, session.season, session.episode);
  await progress.info(`Using options — headless: ${session.headless}, flaresolverr: ${session.useFlareSolverr}`);
  await progress.info(`Searching for "${searchTerm}" at the saved site`);

  const { results, searchUrl: fetchedUrl } = await runSearch(searchTerm, storedWebsite, (step) => progress.info(step), {
    useFlareSolverr: session.useFlareSolverr,
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

  const token = saveResults(results, {
    useFlareSolverr: session.useFlareSolverr,
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
        ? 'Select headless mode to begin your interactive search.'
        : 'No website saved yet. Use /website to set one first.',
      embeds: [buildSummaryEmbed(session)],
      components: [headlessButtons(session.id)],
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

    if (step === 'headless') {
      session.headless = value === 'true';
      await interaction.update({
        content: 'Choose whether to use FlareSolverr.',
        embeds: [buildSummaryEmbed(session)],
        components: [flaresolverrButtons(session.id)],
      });
      return true;
    }

    if (step === 'flaresolverr') {
      session.useFlareSolverr = value === 'true';
      await interaction.update({
        content: 'Select the media type to continue.',
        embeds: [buildSummaryEmbed(session)],
        components: [mediaTypeButtons(session.id)],
      });
      return true;
    }

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
          .setRequired(true);

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
      }
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
      session.season = Number.parseInt(interaction.fields.getTextInputValue('season'), 10);
      session.episode = Number.parseInt(interaction.fields.getTextInputValue('episode'), 10);
    }

    const correction = await autocorrectTitle(rawName);
    session.name = correction.corrected;
    session.corrected = correction.corrected !== correction.original ? correction.corrected : null;

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

    return true;
  },

  __sessionStore: sessions,
};

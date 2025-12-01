const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, MessageFlags } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
require('dotenv').config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error('DISCORD_TOKEN, DISCORD_CLIENT_ID, and DISCORD_GUILD_ID are required environment variables.');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();
const { getResult, clearToken } = require('./services/resultStore');
const { createProgressTracker } = require('./services/progress');
const { fetchDetailPage, extractDownloadLink } = require('./services/search');
const { addTorrent, isConfigured } = require('./services/qbittorrent');

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  }
}

const rest = new REST({ version: '10' }).setToken(token);

async function removeStaleCommands(commandPayloads) {
  const desiredNames = new Set(commandPayloads.map((command) => command.name));

  const [guildCommands, globalCommands] = await Promise.all([
    rest.get(Routes.applicationGuildCommands(clientId, guildId)),
    rest.get(Routes.applicationCommands(clientId)),
  ]);

  const staleGuild = guildCommands.filter((command) => !desiredNames.has(command.name));
  const staleGlobal = globalCommands.filter((command) => !desiredNames.has(command.name));

  for (const command of staleGuild) {
    await rest.delete(Routes.applicationGuildCommand(clientId, guildId, command.id));
    console.log(`Removed stale guild command: ${command.name}`);
  }

  for (const command of staleGlobal) {
    await rest.delete(Routes.applicationCommand(clientId, command.id));
    console.log(`Removed stale global command: ${command.name}`);
  }
}

async function registerCommands() {
  const commandPayloads = client.commands.map((command) => command.data.toJSON());

  await removeStaleCommands(commandPayloads);

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandPayloads });
  console.log(`Registered ${commandPayloads.length} commands for guild ${guildId}.`);
}

client.once(Events.ClientReady, async (readyClient) => {
  await registerCommands();
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    if (!interaction.customId.startsWith('download:')) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const progress = createProgressTracker({ interaction, scope: 'download' });

    try {
      const [, token, indexString] = interaction.customId.split(':');
      const index = Number.parseInt(indexString, 10);
      const stored = getResult(token, index);

      if (!stored) {
        await progress.fail('This download button has expired. Please run /go-to again.');
        return;
      }

      const { result, options } = stored;

      if (!isConfigured()) {
        await progress.fail('qBittorrent is not configured. Use /qbittorrent first.');
        return;
      }

      if (!result.detailUrl) {
        await progress.fail('No detail link was found for this result.');
        return;
      }

      await progress.info(`Opening detail page for "${result.name}"...`);
      const { html, url } = await fetchDetailPage(result.detailUrl, { useFlareSolverr: options.useFlareSolverr });
      await progress.success(`Fetched detail page from ${url}`);

      await progress.info('Locating download link...');
      const downloadUrl = extractDownloadLink(html, url);

      if (!downloadUrl) {
        await progress.fail('No magnet or torrent link was found on the detail page.');
        return;
      }

      await progress.info('Sending to qBittorrent...');
      await addTorrent(downloadUrl);
      await progress.success('qBittorrent accepted the download.');
      await progress.complete(`🚀 Now downloading: ${result.name}`);

      clearToken(token);
    } catch (error) {
      console.error('[download] Failed to trigger download', error);
      await progress.fail(`Could not start download: ${error.message}`);
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const responseContent = 'There was an error while executing this command!';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: responseContent, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: responseContent, flags: MessageFlags.Ephemeral });
    }
  }
});

client.login(token);

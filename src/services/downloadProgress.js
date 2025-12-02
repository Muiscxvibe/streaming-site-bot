const { MessageFlags } = require('discord.js');
const { getTorrentByTag } = require('./qbittorrent');

function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatEta(seconds) {
  if (!seconds || seconds < 0) return 'Calculating...';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs) return `${hrs}h ${mins}m`;
  if (mins) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function renderProgress(info, displayName) {
  const percent = Math.min(100, Math.round((info.progress || 0) * 100));
  const speed = formatBytes(info.dlspeed || 0);
  const downloaded = formatBytes(info.downloaded || 0);
  const total = formatBytes(info.size || 0);
  const eta = formatEta(info.eta);

  const state = info.state || 'downloading';
  const isError = state.toLowerCase().includes('error');
  const isComplete = percent >= 100 || state.toLowerCase().includes('stalledup') || state.toLowerCase().includes('pausedup');

  const prefix = isError ? '❌' : isComplete ? '✅' : '⬇️';

  return {
    content: `${prefix} ${displayName}\nProgress: ${percent}% — ${downloaded} / ${total}\nSpeed: ${speed}/s — ETA: ${eta}`,
    done: isError || isComplete,
  };
}

async function startDownloadProgress(interaction, { tag, displayName }) {
  if (!interaction?.followUp || !tag) return null;

  const progressMessage = await interaction.followUp({
    content: `📥 Starting download for ${displayName}...`,
    flags: MessageFlags.Ephemeral,
  });

  let misses = 0;

  const tick = async () => {
    try {
      const info = await getTorrentByTag(tag);

      if (!info) {
        misses += 1;
        if (misses > 6) {
          await progressMessage.edit({ content: `⚠️ Could not find the download for ${displayName} to track.` });
          return;
        }
        setTimeout(tick, 5000);
        return;
      }

      const rendered = renderProgress(info, displayName);
      await progressMessage.edit({ content: rendered.content });

      if (!rendered.done) {
        setTimeout(tick, 5000);
      }
    } catch (error) {
      await progressMessage.edit({
        content: `⚠️ Lost connection while tracking **${displayName}**: ${error.message}`,
      });
    }
  };

  setTimeout(tick, 2500);
  return progressMessage;
}

module.exports = { startDownloadProgress, renderProgress, formatBytes, formatEta };

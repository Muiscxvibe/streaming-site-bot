const MAX_CONTENT_LENGTH = 1900;

function createProgressTracker({ interaction, scope }) {
  const steps = [];

  const formatForDiscord = (extra) => {
    const lines = steps.slice();
    let truncated = false;

    const build = () => {
      const body = lines.join('\n');
      return extra ? `${body}\n\n${extra}` : body;
    };

    let message = build();

    while (message.length > MAX_CONTENT_LENGTH && lines.length > 1) {
      truncated = true;
      lines.shift();
      message = build();
    }

    if (message.length > MAX_CONTENT_LENGTH) {
      truncated = true;
      message = message.slice(message.length - MAX_CONTENT_LENGTH);
    }

    if (truncated) {
      const indicator = '...(earlier steps trimmed)...\n';
      if (indicator.length < MAX_CONTENT_LENGTH) {
        message = indicator + message.slice(indicator.length);
      }
    }

    return message;
  };

  const log = async (emoji, message) => {
    const line = `${emoji} ${message}`;
    steps.push(line);

    const consoleLabel = scope ? `[${scope}]` : '';
    console.log(consoleLabel ? `${consoleLabel} ${line}` : line);

    const payload = formatForDiscord();
    if (interaction?.editReply) {
      await interaction.editReply(payload);
    } else if (interaction?.reply) {
      await interaction.reply(payload);
    }
  };

  const complete = async (extra) => {
    const consoleLabel = scope ? `[${scope}]` : '';
    if (extra) {
      console.log(consoleLabel ? `${consoleLabel} ℹ️ ${extra}` : `ℹ️ ${extra}`);
    }

    const finalMessage = formatForDiscord(extra);

    if (interaction?.editReply) {
      await interaction.editReply(finalMessage);
    } else if (interaction?.reply) {
      await interaction.reply(finalMessage);
    }
    return finalMessage;
  };

  return {
    info: (message) => log('⏳', message),
    success: (message) => log('✅', message),
    fail: (message) => log('❌', message),
    complete,
    getSteps: () => steps.slice(),
  };
}

module.exports = { createProgressTracker, MAX_CONTENT_LENGTH };

function createProgressTracker({ interaction, scope }) {
  const steps = [];

  const log = async (emoji, message) => {
    const line = `${emoji} ${message}`;
    steps.push(line);

    const consoleLabel = scope ? `[${scope}]` : '';
    console.log(consoleLabel ? `${consoleLabel} ${line}` : line);

    if (interaction?.editReply) {
      await interaction.editReply(steps.join('\n'));
    } else if (interaction?.reply) {
      await interaction.reply(steps.join('\n'));
    }
  };

  const complete = async (extra) => {
    const body = steps.join('\n');
    const finalMessage = extra ? `${body}\n\n${extra}` : body;

    const consoleLabel = scope ? `[${scope}]` : '';
    if (extra) {
      console.log(consoleLabel ? `${consoleLabel} ℹ️ ${extra}` : `ℹ️ ${extra}`);
    }

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

module.exports = { createProgressTracker };

const { createProgressTracker, MAX_CONTENT_LENGTH } = require('../src/services/progress');

describe('createProgressTracker', () => {
  it('trims earlier steps to stay under Discord length limits', async () => {
    const editReply = jest.fn();
    const tracker = createProgressTracker({ interaction: { editReply }, scope: 'go-to' });

    for (let i = 0; i < 150; i += 1) {
      // Each line is long enough to force trimming once combined.
      // eslint-disable-next-line no-await-in-loop
      await tracker.info(`Step ${i} — ${'x'.repeat(30)}`);
    }

    const lastCallContent = editReply.mock.calls.at(-1)[0];
    expect(lastCallContent.length).toBeLessThanOrEqual(MAX_CONTENT_LENGTH);
    expect(lastCallContent).toContain('earlier steps trimmed');
  });
});

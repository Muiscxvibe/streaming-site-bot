const { safeEdit } = require('../src/services/downloadProgress');

describe('safeEdit', () => {
  it('returns true when edit succeeds', async () => {
    const message = { edit: jest.fn().mockResolvedValue({}) };
    await expect(safeEdit(message, { content: 'ok' })).resolves.toBe(true);
    expect(message.edit).toHaveBeenCalledWith({ content: 'ok' });
  });

  it('returns false when message is missing', async () => {
    const missingError = { code: 10008, message: 'Unknown Message' };
    const message = { edit: jest.fn().mockRejectedValue(missingError) };
    await expect(safeEdit(message, { content: 'lost' })).resolves.toBe(false);
  });

  it('rethrows unexpected errors', async () => {
    const message = { edit: jest.fn().mockRejectedValue(new Error('boom')) };
    await expect(safeEdit(message, { content: 'fail' })).rejects.toThrow('boom');
  });
});

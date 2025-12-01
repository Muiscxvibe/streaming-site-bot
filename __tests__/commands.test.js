jest.mock('../src/services/browser', () => ({
  openWebsite: jest.fn().mockResolvedValue('https://example.com/'),
  ensureUrl: jest.fn((url) => `${url}/`),
}));
jest.mock('../src/services/websiteStore', () => ({
  setWebsite: jest.fn(),
  getWebsite: jest.fn(),
}));
jest.mock('../src/services/flaresolverr', () => ({
  openWithFlareSolverr: jest.fn().mockResolvedValue({
    url: 'https://example.com/',
    endpoint: 'http://solver:8191',
  }),
}));

const { openWebsite } = require('../src/services/browser');
const { setWebsite, getWebsite } = require('../src/services/websiteStore');
const { openWithFlareSolverr } = require('../src/services/flaresolverr');
const goToCommand = require('../src/commands/go-to');
const websiteCommand = require('../src/commands/website');
const { MessageFlags } = require('discord.js');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('go-to command', () => {
  it('replies with success message after opening stored site', async () => {
    const deferReply = jest.fn();
    const editReply = jest.fn();
    getWebsite.mockReturnValue('https://example.com/');
    const options = {
      getBoolean: jest.fn((name) => (name === 'headless' ? null : false)),
    };
    const interaction = { deferReply, editReply, options };

    await goToCommand.execute(interaction);

    expect(openWebsite).toHaveBeenCalledWith('https://example.com/', true);
    expect(deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(editReply).toHaveBeenCalledWith('Opened https://example.com/ in a headless browser');
  });

  it('allows disabling headless mode', async () => {
    const deferReply = jest.fn();
    const editReply = jest.fn();
    getWebsite.mockReturnValue('https://example.com/');
    const options = {
      getBoolean: jest.fn((name) => (name === 'headless' ? false : false)),
    };
    const interaction = { deferReply, editReply, options };

    await goToCommand.execute(interaction);

    expect(openWebsite).toHaveBeenCalledWith('https://example.com/', false);
    expect(deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(editReply).toHaveBeenCalledWith(
      'Opened https://example.com/ with headless mode disabled. The window will stay open until you close it.',
    );
  });

  it('informs users when no site is saved', async () => {
    const deferReply = jest.fn();
    const editReply = jest.fn();
    getWebsite.mockReturnValue(null);
    const interaction = { deferReply, editReply };

    await goToCommand.execute(interaction);

    expect(openWebsite).not.toHaveBeenCalled();
    expect(deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(editReply).toHaveBeenCalledWith('No website saved yet. Use /website to set one first.');
  });

  it('routes through flaresolverr when requested', async () => {
    const deferReply = jest.fn();
    const editReply = jest.fn();
    getWebsite.mockReturnValue('https://example.com/');
    const options = {
      getBoolean: jest.fn((name) => (name === 'use-flaresolverr' ? true : null)),
    };
    const interaction = { deferReply, editReply, options };

    await goToCommand.execute(interaction);

    expect(openWithFlareSolverr).toHaveBeenCalledWith('https://example.com/');
    expect(openWebsite).not.toHaveBeenCalled();
    expect(deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(editReply).toHaveBeenCalledWith('Opened https://example.com/ via FlareSolverr (http://solver:8191).');
  });
});

describe('website command', () => {
  it('stores a website request for admins', async () => {
    const reply = jest.fn();
    const options = { getString: jest.fn().mockReturnValue('https://discord.com') };
    const interaction = { options, reply };

    await websiteCommand.execute(interaction);

    expect(setWebsite).toHaveBeenCalledWith('https://discord.com/');
    expect(reply).toHaveBeenCalledWith({
      content: 'Saved website: https://discord.com/. Use /go-to to open it on the bot machine.',
      flags: MessageFlags.Ephemeral,
    });
  });
});

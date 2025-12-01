jest.mock('../src/services/browser', () => ({
  openWebsite: jest.fn().mockResolvedValue({ url: 'https://example.com/', page: { $x: jest.fn() } }),
  ensureUrl: jest.fn((url) => `${url}/`),
  ensureActivePage: jest.fn(),
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
jest.mock('../src/services/search', () => {
  const actual = jest.requireActual('../src/services/search');
  return {
    ...actual,
    runSearch: jest.fn(),
  };
});

const { openWebsite, ensureActivePage } = require('../src/services/browser');
const { setWebsite, getWebsite } = require('../src/services/websiteStore');
const { openWithFlareSolverr } = require('../src/services/flaresolverr');
const { runSearch } = require('../src/services/search');
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
      getString: jest.fn().mockReturnValue(null),
      getInteger: jest.fn().mockReturnValue(null),
    };
    const interaction = { deferReply, editReply, options };

    await goToCommand.execute(interaction);

    expect(openWebsite).toHaveBeenCalledWith('https://example.com/', true);
    expect(deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(editReply.mock.calls.at(-1)[0]).toContain('Opened https://example.com/ in a headless browser');
  });

  it('allows disabling headless mode', async () => {
    const deferReply = jest.fn();
    const editReply = jest.fn();
    getWebsite.mockReturnValue('https://example.com/');
    const options = {
      getBoolean: jest.fn((name) => (name === 'headless' ? false : false)),
      getString: jest.fn().mockReturnValue(null),
      getInteger: jest.fn().mockReturnValue(null),
    };
    const interaction = { deferReply, editReply, options };

    await goToCommand.execute(interaction);

    expect(openWebsite).toHaveBeenCalledWith('https://example.com/', false);
    expect(deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(editReply.mock.calls.at(-1)[0]).toContain(
      'Opened https://example.com/ with headless mode disabled. The window will stay open until you close it.',
    );
  });

  it('informs users when no site is saved', async () => {
    const deferReply = jest.fn();
    const editReply = jest.fn();
    getWebsite.mockReturnValue(null);
    const interaction = {
      deferReply,
      editReply,
      options: {
        getBoolean: jest.fn().mockReturnValue(null),
        getString: jest.fn().mockReturnValue(null),
        getInteger: jest.fn().mockReturnValue(null),
      },
    };

    await goToCommand.execute(interaction);

    expect(openWebsite).not.toHaveBeenCalled();
    expect(deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(editReply.mock.calls.at(-1)[0]).toContain('No website saved yet. Use /website to set one first.');
  });

  it('routes through flaresolverr when requested', async () => {
    const deferReply = jest.fn();
    const editReply = jest.fn();
    getWebsite.mockReturnValue('https://example.com/');
    const options = {
      getBoolean: jest.fn((name) => (name === 'use-flaresolverr' ? true : null)),
      getString: jest.fn().mockReturnValue(null),
      getInteger: jest.fn().mockReturnValue(null),
    };
    const interaction = { deferReply, editReply, options };

    await goToCommand.execute(interaction);

    expect(openWithFlareSolverr).toHaveBeenCalledWith('https://example.com/');
    expect(openWebsite).toHaveBeenCalledWith('https://example.com/', true);
    expect(deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(editReply.mock.calls.at(-1)[0]).toContain(
      'Opened https://example.com/ via FlareSolverr (http://solver:8191) in a headless browser',
    );
  });

  it('keeps the browser visible when flaresolverr is used without headless mode', async () => {
    const deferReply = jest.fn();
    const editReply = jest.fn();
    getWebsite.mockReturnValue('https://example.com/');
    const options = {
      getBoolean: jest.fn((name) => {
        if (name === 'use-flaresolverr') return true;
        if (name === 'headless') return false;
        return null;
      }),
      getString: jest.fn().mockReturnValue(null),
      getInteger: jest.fn().mockReturnValue(null),
    };
    const interaction = { deferReply, editReply, options };

    await goToCommand.execute(interaction);

    expect(openWithFlareSolverr).toHaveBeenCalledWith('https://example.com/');
    expect(openWebsite).toHaveBeenCalledWith('https://example.com/', false);
    expect(deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(editReply.mock.calls.at(-1)[0]).toContain(
      'Opened https://example.com/ via FlareSolverr (http://solver:8191) with headless mode disabled. The window will stay open until you close it.',
    );
  });

  it('runs a search when search inputs are provided', async () => {
    const deferReply = jest.fn();
    const editReply = jest.fn();
    getWebsite.mockReturnValue('https://example.com/');
    ensureActivePage.mockResolvedValue({ page: { $x: jest.fn() }, revived: false });
    runSearch.mockResolvedValue([
      { name: 'Example s01e01', quality: '1080p', sizeText: '1.4 GB', health: 150 },
      { name: 'Example s01e01 720p', quality: '720p', sizeText: '900 MB', health: 120 },
    ]);

    const options = {
      getBoolean: jest.fn((name) => {
        if (name === 'use-flaresolverr') return false;
        if (name === 'headless') return true;
        return null;
      }),
      getString: jest.fn((name) => {
        if (name === 'type') return 'show';
        if (name === 'name') return 'Example';
        return null;
      }),
      getInteger: jest.fn((name) => {
        if (name === 'season') return 1;
        if (name === 'episode') return 1;
        return null;
      }),
    };

    await goToCommand.execute({ deferReply, editReply, options });

    expect(openWebsite).toHaveBeenCalledWith('https://example.com/', true);
    expect(runSearch).toHaveBeenCalled();
    const finalMessage = editReply.mock.calls.at(-1)[0];
    expect(finalMessage).toContain('Search finished with 2 result(s).');
    expect(finalMessage).toContain('Top matches ordered by health, quality, then smaller sizes:');
  });

  it('validates show requirements when searching', async () => {
    const deferReply = jest.fn();
    const editReply = jest.fn();
    getWebsite.mockReturnValue('https://example.com/');
    ensureActivePage.mockResolvedValue({ page: {}, revived: false });

    const options = {
      getBoolean: jest.fn().mockReturnValue(null),
      getString: jest.fn((name) => {
        if (name === 'type') return 'show';
        if (name === 'name') return 'Example Show';
        return null;
      }),
      getInteger: jest.fn().mockReturnValue(null),
    };

    await goToCommand.execute({ deferReply, editReply, options });

    expect(editReply.mock.calls.at(-1)[0]).toContain('Season and episode are required for shows.');
  });
});

describe('website command', () => {
  it('stores a website request for admins', async () => {
    const deferReply = jest.fn();
    const editReply = jest.fn();
    const options = { getString: jest.fn().mockReturnValue('https://discord.com') };
    const interaction = { options, deferReply, editReply };

    await websiteCommand.execute(interaction);

    expect(setWebsite).toHaveBeenCalledWith('https://discord.com/');
    expect(deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(editReply.mock.calls.at(-1)[0]).toContain(
      'Saved website: https://discord.com/. Use /go-to to open it on the bot machine.',
    );
  });
});

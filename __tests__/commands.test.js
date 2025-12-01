jest.mock('../src/services/websiteStore', () => ({
  setWebsite: jest.fn(),
  getWebsite: jest.fn(),
}));
jest.mock('../src/services/search', () => {
  const actual = jest.requireActual('../src/services/search');
  return {
    ...actual,
    runSearch: jest.fn(),
  };
});
jest.mock('../src/services/resultStore', () => ({
  saveResults: jest.fn(),
}));
jest.mock('../src/services/qbittorrent', () => ({
  isConfigured: jest.fn(),
  setQbittorrentConfig: jest.fn(),
}));

const { setWebsite, getWebsite } = require('../src/services/websiteStore');
const { runSearch } = require('../src/services/search');
const { saveResults } = require('../src/services/resultStore');
const { isConfigured } = require('../src/services/qbittorrent');
const goToCommand = require('../src/commands/go-to');
const websiteCommand = require('../src/commands/website');
const qbittorrentCommand = require('../src/commands/qbittorrent');
const { MessageFlags } = require('discord.js');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('go-to command', () => {
  it('runs a search using the stored site and lists formatted results', async () => {
    const deferReply = jest.fn();
    const editReply = jest.fn();
    getWebsite.mockReturnValue('https://example.com/');
    saveResults.mockReturnValue('token-123');
    isConfigured.mockReturnValue(true);

    runSearch.mockResolvedValue({
      results: [
        {
          name: 'Example s01e01',
          quality: '1080p',
          sizeText: '1.4 GB',
          health: 150,
          detailUrl: 'https://example.com/example.torrent',
        },
        {
          name: 'Example s01e01 720p',
          quality: '720p',
          sizeText: '900 MB',
          health: 120,
          detailUrl: 'https://example.com/example2.torrent',
        },
      ],
      searchUrl: 'https://example.com/search/all/example-s01e01/',
    });

    const options = {
      getBoolean: jest.fn((name) => {
        if (name === 'use-flaresolverr') return false;
        if (name === 'headless') return false;
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

    expect(runSearch).toHaveBeenCalledWith(
      'Example s01e01',
      'https://example.com/',
      expect.any(Function),
      { useFlareSolverr: false },
    );
    const finalMessage = editReply.mock.calls.at(-1)[0];
    expect(finalMessage.content).toContain('Top matches ordered by health, quality, then smaller sizes:');
    expect(finalMessage.content).toContain('Example s01e01');
    expect(finalMessage.components[0].components).toHaveLength(2);
    expect(saveResults).toHaveBeenCalled();
  });

  it('passes the flaresolverr option through to the search service', async () => {
    const deferReply = jest.fn();
    const editReply = jest.fn();
    getWebsite.mockReturnValue('https://example.com/');
    saveResults.mockReturnValue('token-123');
    isConfigured.mockReturnValue(false);

    runSearch.mockResolvedValue({ results: [], searchUrl: 'https://example.com/search/all/example/' });

    const options = {
      getBoolean: jest.fn((name) => (name === 'use-flaresolverr' ? true : null)),
      getString: jest.fn((name) => {
        if (name === 'type') return 'movie';
        if (name === 'name') return 'Example';
        return null;
      }),
      getInteger: jest.fn().mockReturnValue(null),
    };

    await goToCommand.execute({ deferReply, editReply, options });

    expect(runSearch).toHaveBeenCalledWith(
      'Example',
      'https://example.com/',
      expect.any(Function),
      { useFlareSolverr: true },
    );
    expect(editReply.mock.calls.at(-1)[0]).toContain('No matching results were found for "Example".');
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

    expect(runSearch).not.toHaveBeenCalled();
    expect(deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(editReply.mock.calls.at(-1)[0]).toContain('No website saved yet. Use /website to set one first.');
  });

  it('validates show requirements when searching', async () => {
    const deferReply = jest.fn();
    const editReply = jest.fn();
    getWebsite.mockReturnValue('https://example.com/');

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

    expect(runSearch).not.toHaveBeenCalled();
    expect(editReply.mock.calls.at(-1)[0]).toContain('Season and episode are required for shows.');
  });
});

describe('website command', () => {
  it('stores a website when invoked', async () => {
    const deferReply = jest.fn();
    const editReply = jest.fn();
    const interaction = {
      options: { getString: jest.fn().mockReturnValue('https://example.com') },
      deferReply,
      editReply,
    };

    await websiteCommand.execute(interaction);

    expect(setWebsite).toHaveBeenCalledWith('https://example.com/');
    expect(deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    const finalMessage = editReply.mock.calls.at(-1)[0];
    expect(finalMessage).toContain('Saved website: https://example.com/. Use /go-to to open it on the bot machine.');
  });
});

describe('qbittorrent command', () => {
  it('saves configuration and reports success', async () => {
    const deferReply = jest.fn();
    const editReply = jest.fn();
    const options = {
      getString: jest.fn((name) => {
        if (name === 'host') return 'http://localhost:8080';
        if (name === 'username') return 'admin';
        if (name === 'password') return 'secret';
        return null;
      }),
    };

    await qbittorrentCommand.execute({ deferReply, editReply, options });

    expect(deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(editReply.mock.calls.at(-1)[0]).toContain('qBittorrent connection saved');
  });
});

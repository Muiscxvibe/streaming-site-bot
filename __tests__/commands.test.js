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
  it('starts an interactive session with headless buttons', async () => {
    const reply = jest.fn();
    getWebsite.mockReturnValue('https://example.com/');
    const interaction = { user: { id: 'user1' }, reply };

    await goToCommand.execute(interaction);

    const call = reply.mock.calls[0][0];
    expect(call.content).toContain('Select headless mode');
    expect(call.components[0].components[0].data.custom_id).toContain('goto:headless');
  });

  it('advances to flaresolverr choice when headless is selected', async () => {
    const reply = jest.fn();
    const update = jest.fn();
    getWebsite.mockReturnValue('https://example.com/');
    const interaction = { user: { id: 'user1' }, reply };
    await goToCommand.execute(interaction);

    const sessionId = [...goToCommand.__sessionStore.keys()].at(-1);
    await goToCommand.handleButton({
      customId: `goto:headless:${sessionId}:true`,
      update,
      user: { id: 'user1' },
      reply,
    });

    expect(update).toHaveBeenCalled();
    const payload = update.mock.calls[0][0];
    expect(payload.components[0].components[0].data.custom_id).toContain('goto:flaresolverr');
  });

  it('runs a movie search after modal submission without correction', async () => {
    getWebsite.mockReturnValue('https://example.com/');
    saveResults.mockReturnValue('token-123');
    isConfigured.mockReturnValue(true);
    runSearch.mockResolvedValue({
      results: [
        { name: 'Movie', quality: '720p', sizeText: '700 MB', health: 100, detailUrl: 'https://detail' },
      ],
      searchUrl: 'https://example.com/search/all/movie/',
    });

    const reply = jest.fn();
    const editReply = jest.fn();
    const interaction = { user: { id: 'user1' }, reply };
    await goToCommand.execute(interaction);
    const sessionId = [...goToCommand.__sessionStore.keys()].at(-1);
    const session = goToCommand.__sessionStore.get(sessionId);
    session.headless = false;
    session.useFlareSolverr = false;

    await goToCommand.handleModal({
      customId: `goto-modal:movie:${sessionId}`,
      fields: { getTextInputValue: (name) => (name === 'name' ? 'Moive' : '') },
      user: { id: 'user1' },
      reply,
      editReply,
    });

    expect(runSearch).toHaveBeenCalled();
    expect(saveResults).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ searchType: 'movie' }));
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

jest.mock('../src/services/browser', () => ({
  openWebsite: jest.fn().mockResolvedValue('https://example.com/'),
  ensureUrl: jest.fn((url) => `${url}/`),
}));
jest.mock('../src/services/websiteStore', () => ({
  setWebsite: jest.fn(),
  getWebsite: jest.fn(),
}));

const { openWebsite } = require('../src/services/browser');
const { setWebsite, getWebsite } = require('../src/services/websiteStore');
const goToCommand = require('../src/commands/go-to');
const websiteCommand = require('../src/commands/website');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('go-to command', () => {
  it('replies with success message after opening stored site', async () => {
    const reply = jest.fn();
    getWebsite.mockReturnValue('https://example.com/');
    const interaction = { reply };

    await goToCommand.execute(interaction);

    expect(openWebsite).toHaveBeenCalledWith('https://example.com/');
    expect(reply).toHaveBeenCalledWith({
      content: 'Opened https://example.com/ in a headless browser.',
      ephemeral: true,
    });
  });

  it('informs users when no site is saved', async () => {
    const reply = jest.fn();
    getWebsite.mockReturnValue(null);
    const interaction = { reply };

    await goToCommand.execute(interaction);

    expect(openWebsite).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith({
      content: 'No website saved yet. Use /website to set one first.',
      ephemeral: true,
    });
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
      ephemeral: true,
    });
  });
});

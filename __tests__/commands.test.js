jest.mock('../src/services/browser', () => ({
  openWebsite: jest.fn().mockResolvedValue('https://example.com/'),
}));

const { openWebsite } = require('../src/services/browser');
const goToCommand = require('../src/commands/go-to');
const websiteCommand = require('../src/commands/website');

describe('go-to command', () => {
  it('replies with success message after opening site', async () => {
    const reply = jest.fn();
    const options = { getString: jest.fn().mockReturnValue('example.com') };
    const interaction = { options, reply };

    await goToCommand.execute(interaction);

    expect(openWebsite).toHaveBeenCalledWith('example.com');
    expect(reply).toHaveBeenCalledWith({
      content: 'Opened https://example.com/ in a headless browser.',
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

    expect(reply).toHaveBeenCalledWith({
      content: 'Saved website: https://discord.com. Use /go-to to open it in a headless browser.',
      ephemeral: true,
    });
  });
});

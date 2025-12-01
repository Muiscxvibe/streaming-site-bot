jest.mock('puppeteer', () => {
  const goto = jest.fn();
  const newPage = jest.fn().mockResolvedValue({ goto });
  const close = jest.fn();
  const browser = { newPage, close };

  return {
    launch: jest.fn().mockResolvedValue(browser),
    __mockBrowser: browser,
    __mockGoto: goto,
  };
});

const puppeteer = require('puppeteer');
const { ensureUrl, openWebsite, GOTO_OPTIONS } = require('../src/services/browser');

describe('ensureUrl', () => {
  it('adds https when protocol missing', () => {
    expect(ensureUrl('example.com')).toBe('https://example.com/');
  });

  it('keeps existing protocol', () => {
    expect(ensureUrl('http://example.com')).toBe('http://example.com/');
  });

  it('throws for invalid url', () => {
    expect(() => ensureUrl('not a url')).toThrow('Invalid URL');
  });
});

describe('openWebsite', () => {
  it('launches a headless browser and navigates', async () => {
    const normalized = await openWebsite('example.com');

    expect(normalized).toBe('https://example.com/');
    expect(puppeteer.launch).toHaveBeenCalledWith({ headless: true });
    expect(puppeteer.__mockBrowser.newPage).toHaveBeenCalled();
    expect(puppeteer.__mockGoto).toHaveBeenCalledWith('https://example.com/', GOTO_OPTIONS);
    expect(puppeteer.__mockBrowser.close).not.toHaveBeenCalled();
  });
});

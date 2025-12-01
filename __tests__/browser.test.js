jest.mock('puppeteer', () => {
  const goto = jest.fn();
  const page = {
    goto,
    isClosed: jest.fn().mockReturnValue(false),
    close: jest.fn(),
    $x: jest.fn(),
    waitForXPath: jest.fn(),
  };
  const newPage = jest.fn().mockResolvedValue(page);
  const close = jest.fn();
  const pages = jest.fn().mockResolvedValue([page]);
  const process = jest.fn(() => ({ killed: false }));
  const browser = { newPage, close, pages, process };

  return {
    launch: jest.fn().mockResolvedValue(browser),
    __mockBrowser: browser,
    __mockGoto: goto,
    __mockPage: page,
  };
});

const puppeteer = require('puppeteer');
const { ensureUrl, openWebsite, GOTO_OPTIONS, ensureActivePage } = require('../src/services/browser');

beforeEach(() => {
  jest.clearAllMocks();
});

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
    const { url, page } = await openWebsite('example.com');

    expect(url).toBe('https://example.com/');
    expect(page).toBe(puppeteer.__mockPage);
    expect(puppeteer.launch).toHaveBeenCalledWith({ headless: true });
    expect(puppeteer.__mockBrowser.newPage).toHaveBeenCalled();
    expect(puppeteer.__mockGoto).toHaveBeenCalledWith('https://example.com/', GOTO_OPTIONS);
    expect(puppeteer.__mockBrowser.close).not.toHaveBeenCalled();
  });
});

describe('ensureActivePage', () => {
  it('returns an existing page if one is open', async () => {
    await openWebsite('example.com');

    const { page, revived } = await ensureActivePage();

    expect(page).toBe(puppeteer.__mockPage);
    expect(revived).toBe(false);
  });

  it('reopens the last URL when the current page is unusable', async () => {
    const unusablePage = {
      isClosed: jest.fn().mockReturnValue(false),
      goto: jest.fn(),
      close: jest.fn(),
    };
    puppeteer.__mockBrowser.newPage
      .mockResolvedValueOnce(unusablePage)
      .mockResolvedValue(puppeteer.__mockPage);
    puppeteer.__mockBrowser.pages.mockResolvedValue([unusablePage]);

    await openWebsite('example.com');

    const { page, revived } = await ensureActivePage();

    expect(revived).toBe(true);
    expect(puppeteer.__mockBrowser.newPage).toHaveBeenCalledTimes(2);
    expect(page).toBe(puppeteer.__mockPage);
  });
});

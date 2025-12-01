const puppeteer = require('puppeteer');

const GOTO_OPTIONS = { waitUntil: 'networkidle2', timeout: 30000 };

function ensureUrl(target) {
  if (!target || typeof target !== 'string') {
    throw new Error('A URL string is required.');
  }

  const trimmed = target.trim();
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(normalized);
  return parsed.toString();
}

let browserInstance = null;
let currentPage = null;
let currentHeadless = true;
let lastOpenedUrl = null;

async function ensureBrowser(headless = true) {
  const isRunning = browserInstance && browserInstance.process() && !browserInstance.process().killed;

  if (isRunning && currentHeadless === headless) {
    return browserInstance;
  }

  if (browserInstance) {
    await browserInstance.close();
  }

  browserInstance = await puppeteer.launch({ headless });
  currentHeadless = headless;
  return browserInstance;
}

async function openWebsite(target, headless = true) {
  const url = ensureUrl(target);
  const browser = await ensureBrowser(headless);

  if (currentPage && !currentPage.isClosed()) {
    await currentPage.close();
  }

  currentPage = await browser.newPage();
  lastOpenedUrl = url;

  try {
    await currentPage.goto(url, GOTO_OPTIONS);
  } catch (error) {
    await browser.close();
    browserInstance = null;
    currentPage = null;
    throw error;
  }

  return url;
}

function getActivePage() {
  if (currentPage && typeof currentPage.isClosed === 'function' && !currentPage.isClosed()) {
    return currentPage;
  }

  if (currentPage && typeof currentPage.isClosed !== 'function') {
    return currentPage;
  }

  return null;
}

async function ensureActivePage() {
  const active = getActivePage();
  if (active) {
    return { page: active, revived: false };
  }

  if (browserInstance && browserInstance.process && !browserInstance.process().killed) {
    try {
      const pages = await browserInstance.pages();
      const firstOpenPage = pages.find((page) => {
        if (typeof page.isClosed !== 'function') return true;
        return !page.isClosed();
      });

      if (firstOpenPage) {
        currentPage = firstOpenPage;
        return { page: currentPage, revived: true };
      }
    } catch (error) {
      console.warn('[browser] Failed to inspect existing pages', error);
    }
  }

  if (lastOpenedUrl) {
    try {
      await openWebsite(lastOpenedUrl, currentHeadless);
      return { page: currentPage, revived: true };
    } catch (error) {
      console.warn('[browser] Failed to reopen last page', error);
    }
  }

  return { page: null, revived: false };
}

module.exports = {
  ensureUrl,
  openWebsite,
  GOTO_OPTIONS,
  getActivePage,
  ensureActivePage,
};

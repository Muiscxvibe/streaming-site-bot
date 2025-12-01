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
  if (currentPage && !currentPage.isClosed()) {
    return currentPage;
  }
  return null;
}

module.exports = {
  ensureUrl,
  openWebsite,
  GOTO_OPTIONS,
  getActivePage,
};

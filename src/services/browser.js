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

async function openWebsite(target, headless = true) {
  const url = ensureUrl(target);
  const browser = await puppeteer.launch({ headless });
  const page = await browser.newPage();

  try {
    await page.goto(url, GOTO_OPTIONS);
  } catch (error) {
    await browser.close();
    throw error;
  }

  if (headless) {
    await browser.close();
  }

  return url;
}

module.exports = {
  ensureUrl,
  openWebsite,
  GOTO_OPTIONS,
};

const { ensureUrl, GOTO_OPTIONS } = require('./browser');

const RESULTS_TBODY_XPATH = '/html/body/div[1]/div[6]/div[1]/table[2]/tbody';

const QUALITY_ORDER = ['2160p', '1440p', '1080p', '720p', '480p', '360p'];

async function waitForXPath(page, xpath, options = {}) {
  if (typeof page.waitForXPath === 'function') {
    return page.waitForXPath(xpath, options);
  }

  const timeout = options.timeout ?? 30000;
  await page.waitForFunction(
    (target) => {
      try {
        return Boolean(
          document.evaluate(target, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue,
        );
      } catch (error) {
        console.warn('[search] XPath evaluation failed', error);
        return false;
      }
    },
    { timeout },
    xpath,
  );

  const handles = await page.$x(xpath);
  if (!handles.length) {
    throw new Error(`Element not found for XPath: ${xpath}`);
  }

  return handles[0];
}

function buildSearchTerm(type, name, season, episode) {
  if (!type || !name) {
    throw new Error('Type (movie/show) and name are required to search.');
  }

  if (type === 'show') {
    if (season == null || episode == null) {
      throw new Error('Season and episode are required for shows.');
    }

    const paddedSeason = String(season).padStart(2, '0');
    const paddedEpisode = String(episode).padStart(2, '0');
    return `${name} s${paddedSeason}e${paddedEpisode}`;
  }

  return name;
}

function slugifySearchTerm(term) {
  return term
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildSearchUrl(baseUrl, searchTerm) {
  if (!baseUrl) {
    throw new Error('A base URL is required to build the search URL.');
  }

  const normalizedBase = new URL(ensureUrl(baseUrl));
  const slug = slugifySearchTerm(searchTerm);
  const searchPath = `/search/all/${slug}/`;

  return new URL(searchPath, normalizedBase.origin).toString();
}

function formatResults(results, term) {
  if (!results.length) {
    return `No matching results were found for "${term}".`;
  }

  const lines = results.map((result, index) => {
    const quality = result.quality ? result.quality.toUpperCase() : 'Unknown quality';
    const size = result.sizeText || 'Unknown size';
    const health = result.health ? `${result.health} health/seed score` : 'Unknown health';

    return `${index + 1}. ${result.name} — Quality: ${quality}; Size: ${size}; Health: ${health}`;
  });

  return [
    'Top matches ordered by health, quality, then smaller sizes:',
    ...lines,
    'Results are ordered best to worst based on health, quality, and reasonable size.',
  ].join('\n');
}

function toSizeMb(sizeText) {
  if (!sizeText) return null;
  const match = sizeText.match(/([\d.]+)\s*(TB|GB|MB|KB)/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  if (Number.isNaN(value)) return null;

  const factor = {
    TB: 1024 * 1024,
    GB: 1024,
    MB: 1,
    KB: 1 / 1024,
  }[unit];

  return factor ? value * factor : null;
}

function parseQuality(text) {
  const match = text.match(/(2160p|1440p|1080p|720p|480p|360p)/i);
  return match ? match[1].toLowerCase() : null;
}

function healthScore(texts) {
  const numbers = texts.flatMap((cell) => (cell.match(/\d+/g) || []).map((value) => Number(value)));
  if (!numbers.length) return 0;
  return Math.max(...numbers);
}

function normalizeResults(rawRows) {
  return rawRows.map((row) => {
    const cells = row.cells.length ? row.cells : [row.text];
    const joined = cells.join(' ');
    const quality = parseQuality(joined);
    const sizeText = cells.find((cell) => /(TB|GB|MB|KB)/i.test(cell));
    const sizeMb = toSizeMb(sizeText || '');
    const health = healthScore(cells);

    const rank = QUALITY_ORDER.indexOf((quality || '').toLowerCase());

    return {
      name: cells[0] || row.text,
      quality,
      qualityRank: rank === -1 ? Number.POSITIVE_INFINITY : rank,
      sizeText: sizeText || 'Unknown',
      sizeMb,
      health,
      cells,
    };
  });
}

function sortResults(results) {
  return results
    .slice()
    .sort((a, b) => {
      if (b.health !== a.health) return b.health - a.health;
      if (a.qualityRank !== b.qualityRank) return a.qualityRank - b.qualityRank;
      if (a.sizeMb != null && b.sizeMb != null) return a.sizeMb - b.sizeMb;
      if (a.sizeMb != null) return -1;
      if (b.sizeMb != null) return 1;
      return 0;
    })
    .filter((result) => result.name);
}

async function runSearch(page, searchTerm, report = () => {}) {
  if (!page || typeof page.$x !== 'function') {
    throw new Error('Active browser page is unavailable. Run /go-to again to refresh it.');
  }

  if (!searchTerm) {
    throw new Error('A search term is required.');
  }

  await report('Focusing active page');
  await page.bringToFront().catch(() => {});

  await report('Navigating directly to the search URL');
  const searchUrl = buildSearchUrl(page.url(), searchTerm);
  await page.goto(searchUrl, GOTO_OPTIONS);

  await report('Waiting for results table');
  const resultsBody = await waitForXPath(page, RESULTS_TBODY_XPATH, { timeout: 20000 });
  const rows = await resultsBody.$x('./tr');

  await report(`Found ${rows.length} row(s) in the results table`);

  const rawRows = await Promise.all(
    rows.map(async (row) => ({
      text: await row.evaluate((el) => el.innerText.trim()),
      cells: await row.$$eval('td', (tds) => tds.map((td) => td.innerText.trim())),
    })),
  );

  await report('Normalizing and ranking results');
  const normalized = normalizeResults(rawRows);
  const sorted = sortResults(normalized).slice(0, 5);

  return sorted;
}

module.exports = {
  RESULTS_TBODY_XPATH,
  buildSearchTerm,
  buildSearchUrl,
  formatResults,
  runSearch,
  normalizeResults,
  sortResults,
  slugifySearchTerm,
  waitForXPath,
};

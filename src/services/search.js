const cheerio = require('cheerio');
const { ensureUrl } = require('./browser');
const { fetchWithFallback, fetchPageWithFlareSolverr } = require('./flaresolverr');

const RESULT_ROW_SELECTORS = [
  'body > div:nth-of-type(1) > div:nth-of-type(6) > div:nth-of-type(1) > table:nth-of-type(2) tbody tr',
  'div:nth-of-type(6) table:nth-of-type(2) tbody tr',
  'table:nth-of-type(2) tbody tr',
  'tbody tr',
  'table tr',
];

const DOWNLOAD_LINK_SELECTORS = [
  'body > div:nth-of-type(1) > div:nth-of-type(6) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div > div:nth-of-type(4) a',
  'div:nth-of-type(6) div:nth-of-type(1) div:nth-of-type(1) div:nth-of-type(1) div:nth-of-type(1) div div:nth-of-type(4) a',
  'a[href^="magnet:"]',
  'a[href$=".torrent"]',
];

const QUALITY_ORDER = ['2160p', '1440p', '1080p', '720p', '480p', '360p'];

async function fetchPageHtml(targetUrl) {
  const url = ensureUrl(targetUrl);
  const response = await fetchWithFallback(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();
  return { html, url };
}

async function fetchDetailPage(targetUrl, { useFlareSolverr = false } = {}) {
  const url = ensureUrl(targetUrl);

  if (useFlareSolverr) {
    return fetchPageWithFlareSolverr(url);
  }

  const response = await fetchWithFallback(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();
  return { html, url };
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
      detailUrl: row.detailUrl,
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

function extractRowsFromHtml(html, baseUrl) {
  const $ = cheerio.load(html);

  for (const selector of RESULT_ROW_SELECTORS) {
    const rows = $(selector).toArray();

    if (rows.length) {
      return rows.map((row) => {
        const cells = $(row)
          .find('td')
          .toArray()
          .map((cell) => $(cell).text().trim())
          .filter(Boolean);

        const linkHref = $(row).find('a[href]').attr('href');
        const detailUrl = linkHref
          ? new URL(linkHref, baseUrl ? ensureUrl(baseUrl) : undefined).toString()
          : null;

        const text = cells.join(' ').trim() || $(row).text().trim();
        return { cells, text, detailUrl };
      });
    }
  }

  return [];
}

async function runSearch(searchTerm, baseUrl, report = () => {}, { useFlareSolverr = false } = {}) {
  if (!searchTerm) {
    throw new Error('A search term is required.');
  }

  if (!baseUrl) {
    throw new Error('A base URL is required.');
  }

  const searchUrl = buildSearchUrl(baseUrl, searchTerm);
  await report(`Navigating directly to the search URL: ${searchUrl}`);

  const { html, url: fetchedUrl } = useFlareSolverr
    ? await fetchPageWithFlareSolverr(searchUrl)
    : await fetchPageHtml(searchUrl);

  await report(`Fetched search page from ${fetchedUrl}`);
  await report('Parsing results table');

  const rawRows = extractRowsFromHtml(html, baseUrl);

  await report(`Found ${rawRows.length} row(s) in the results table`);
  await report('Normalizing and ranking results');
  const normalized = normalizeResults(rawRows);
  const results = sortResults(normalized).slice(0, 5);

  return { results, searchUrl: fetchedUrl };
}

function extractDownloadLink(html, detailUrl) {
  const $ = cheerio.load(html);

  const resolveHref = (href) => {
    if (!href) return null;
    return href.startsWith('magnet:') || href.startsWith('http')
      ? href
      : new URL(href, detailUrl ? ensureUrl(detailUrl) : undefined).toString();
  };

  const candidates = [];

  for (const selector of DOWNLOAD_LINK_SELECTORS) {
    const anchors = $(selector).toArray();
    if (!anchors.length) continue;

    anchors.forEach((node) => {
      const anchor = $(node);
      const resolved = resolveHref(anchor.attr('href'));
      if (!resolved) return;

      const text = anchor.text().toLowerCase();
      const score = resolved.startsWith('magnet:')
        ? 3
        : resolved.endsWith('.torrent')
          ? 2
          : /magnet|torrent/.test(text)
            ? 1
            : 0;

      candidates.push({ href: resolved, score });
    });
  }

  if (!candidates.length) {
    $('a[href]').toArray().forEach((node) => {
      const anchor = $(node);
      const resolved = resolveHref(anchor.attr('href'));
      if (!resolved) return;

      const text = anchor.text().toLowerCase();
      const score = resolved.startsWith('magnet:')
        ? 3
        : resolved.endsWith('.torrent')
          ? 2
          : /magnet|torrent/.test(text)
            ? 1
            : 0;

      candidates.push({ href: resolved, score });
    });
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].href;
}

module.exports = {
  RESULT_ROW_SELECTORS,
  buildSearchTerm,
  buildSearchUrl,
  formatResults,
  runSearch,
  normalizeResults,
  sortResults,
  slugifySearchTerm,
  extractRowsFromHtml,
  extractDownloadLink,
  fetchDetailPage,
};

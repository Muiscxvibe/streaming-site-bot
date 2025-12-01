const FORM_XPATH = '/html/body/div[2]/div/div[2]/form';
const RESULTS_TBODY_XPATH = '/html/body/div[1]/div[6]/div[1]/table[2]/tbody';

const QUALITY_ORDER = ['2160p', '1440p', '1080p', '720p', '480p', '360p'];

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

async function runSearch(page, searchTerm) {
  await page.bringToFront().catch(() => {});
  const [formHandle] = await page.$x(FORM_XPATH);

  if (!formHandle) {
    throw new Error('Search form not found on the page. Run /go-to and try again.');
  }

  const textInput =
    (await formHandle.$('input[type="text"]')) ||
    (await formHandle.$('input[name]')) ||
    (await formHandle.$('input'));

  if (!textInput) {
    throw new Error('Could not locate the search input inside the form.');
  }

  await textInput.click({ clickCount: 3 }).catch(() => {});
  await textInput.evaluate((el) => {
    el.value = '';
  });
  await textInput.type(searchTerm);

  const submitButton = (await formHandle.$('button[type="submit"]')) || (await formHandle.$('input[type="submit"]'));

  if (submitButton) {
    await submitButton.click();
  } else {
    await textInput.press('Enter');
  }

  const resultsBody = await page.waitForXPath(RESULTS_TBODY_XPATH, { timeout: 20000 });
  const rows = await resultsBody.$x('./tr');

  const rawRows = await Promise.all(
    rows.map(async (row) => ({
      text: await row.evaluate((el) => el.innerText.trim()),
      cells: await row.$$eval('td', (tds) => tds.map((td) => td.innerText.trim())),
    })),
  );

  const normalized = normalizeResults(rawRows);
  const sorted = sortResults(normalized).slice(0, 5);

  return sorted;
}

module.exports = {
  FORM_XPATH,
  RESULTS_TBODY_XPATH,
  runSearch,
  normalizeResults,
  sortResults,
};

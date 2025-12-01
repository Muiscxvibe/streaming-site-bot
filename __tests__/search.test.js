jest.mock('../src/services/flaresolverr', () => ({
  fetchWithFallback: jest.fn(),
  fetchPageWithFlareSolverr: jest.fn(),
}));

const { fetchWithFallback, fetchPageWithFlareSolverr } = require('../src/services/flaresolverr');
const {
  buildSearchTerm,
  buildSearchUrl,
  slugifySearchTerm,
  runSearch,
  extractRowsFromHtml,
  extractDownloadLink,
} = require('../src/services/search');

describe('search helpers', () => {
  it('builds show search terms with zero padding', () => {
    expect(buildSearchTerm('show', 'South Park', 1, 2)).toBe('South Park s01e02');
  });

  it('builds movie search terms without padding', () => {
    expect(buildSearchTerm('movie', 'Inception')).toBe('Inception');
  });

  it('slugifies terms for the search URL', () => {
    expect(slugifySearchTerm('South Park s01e02')).toBe('south-park-s01e02');
  });

  it('constructs the site search URL', () => {
    const url = buildSearchUrl('https://www.limetorrents.fun', 'South Park s04e05');
    expect(url).toBe('https://www.limetorrents.fun/search/all/south-park-s04e05/');
  });
});

describe('runSearch', () => {
  const sampleHtml = `
    <html>
      <body>
        <div>
          <div></div><div></div><div></div><div></div><div></div>
          <div>
            <div>
              <table></table>
              <table>
                <tbody>
                  <tr><td>Show s01e01 1080p</td><td>1.2 GB</td><td>200</td></tr>
                  <tr><td>Show s01e01 720p</td><td>900 MB</td><td>150</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchWithFallback.mockResolvedValue({ ok: true, text: () => Promise.resolve(sampleHtml) });
    fetchPageWithFlareSolverr.mockResolvedValue({ html: sampleHtml, url: 'https://example.com/solved' });
  });

  it('extracts rows from the sample html', () => {
    const rows = extractRowsFromHtml(sampleHtml, 'https://example.com');
    expect(rows).toHaveLength(2);
    expect(rows[0].detailUrl).toBeNull();
  });

  it('fetches and parses results with a direct request', async () => {
    const { results, searchUrl } = await runSearch('Show s01e01', 'https://example.com');

    expect(searchUrl).toBe('https://example.com/search/all/show-s01e01/');
    expect(fetchWithFallback).toHaveBeenCalled();
    expect(results[0].name).toContain('1080p');
  });

  it('fetches via flaresolverr when requested', async () => {
    const { results, searchUrl } = await runSearch('Show s01e01', 'https://example.com', () => {}, { useFlareSolverr: true });

    expect(searchUrl).toBe('https://example.com/solved');
    expect(fetchPageWithFlareSolverr).toHaveBeenCalled();
    expect(results).toHaveLength(2);
  });

  it('extracts a magnet from detail html when present', () => {
    const detailHtml = '<html><body><a href="magnet:?xt=urn:btih:123">magnet</a></body></html>';
    const download = extractDownloadLink(detailHtml, 'https://example.com/detail');
    expect(download).toBe('magnet:?xt=urn:btih:123');
  });

  it('finds a magnet link that is not the first anchor', () => {
    const detailHtml = `
      <html>
        <body>
          <div><a href="/irrelevant">ignore me</a></div>
          <div><a href="magnet:?xt=urn:btih:456">Magnet Download</a></div>
        </body>
      </html>
    `;

    const download = extractDownloadLink(detailHtml, 'https://example.com/detail');
    expect(download).toBe('magnet:?xt=urn:btih:456');
  });

  it('falls back to any torrent link when selectors miss', () => {
    const detailHtml = `
      <html>
        <body>
          <div>
            <a href="/downloads/file.torrent">Torrent Download</a>
          </div>
        </body>
      </html>
    `;

    const download = extractDownloadLink(detailHtml, 'https://example.com/detail');
    expect(download).toBe('https://example.com/downloads/file.torrent');
  });
});

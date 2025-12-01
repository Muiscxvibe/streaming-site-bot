const { buildSearchTerm, buildSearchUrl, slugifySearchTerm } = require('../src/services/search');

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

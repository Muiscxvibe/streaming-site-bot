function getStore() {
  jest.resetModules();
  return require('../src/services/savePathStore');
}

describe('savePathStore', () => {
  test('returns default paths for movies and shows', () => {
    const { getSavePathForType, DEFAULT_MOVIE_PATH, DEFAULT_SHOW_PATH } = getStore();
    expect(getSavePathForType('show')).toBe(DEFAULT_SHOW_PATH);
    expect(getSavePathForType('movie')).toBe(DEFAULT_MOVIE_PATH);
  });

  test('updates the path for a given type', () => {
    const { setSavePath, getSavePaths } = getStore();
    setSavePath('show', 'C:/media/shows');
    setSavePath('movie', 'C:/media/movies');

    const { show, movie } = getSavePaths();
    expect(show).toBe('C:/media/shows');
    expect(movie).toBe('C:/media/movies');
  });

  test('throws for invalid type', () => {
    const { getSavePathForType, setSavePath } = getStore();
    expect(() => getSavePathForType('invalid')).toThrow('Type must be either "show" or "movie".');
    expect(() => setSavePath('invalid', 'path')).toThrow('Type must be either "show" or "movie".');
  });

  test('throws when setting an empty path', () => {
    const { setSavePath } = getStore();
    expect(() => setSavePath('show', '')).toThrow('A non-empty path is required.');
  });
});

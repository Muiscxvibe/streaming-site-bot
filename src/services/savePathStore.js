const DEFAULT_SHOW_PATH = 'C:\\Users\\codey\\Desktop\\bot development\\website\\media-stack\\shows';
const DEFAULT_MOVIE_PATH = 'C:\\Users\\codey\\Desktop\\bot development\\website\\media-stack\\movies';

let savePaths = {
  show: DEFAULT_SHOW_PATH,
  movie: DEFAULT_MOVIE_PATH,
};

function validateType(type) {
  if (type !== 'show' && type !== 'movie') {
    throw new Error('Type must be either "show" or "movie".');
  }
}

function setSavePath(type, path) {
  validateType(type);

  if (!path || !String(path).trim()) {
    throw new Error('A non-empty path is required.');
  }

  savePaths = {
    ...savePaths,
    [type]: String(path).trim(),
  };
}

function getSavePaths() {
  return { ...savePaths };
}

function getSavePathForType(type) {
  validateType(type);
  return savePaths[type];
}

module.exports = {
  DEFAULT_MOVIE_PATH,
  DEFAULT_SHOW_PATH,
  getSavePathForType,
  getSavePaths,
  setSavePath,
};

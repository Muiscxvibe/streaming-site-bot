let storedWebsite = null;

function setWebsite(url) {
  storedWebsite = url;
}

function getWebsite() {
  return storedWebsite;
}

function clearWebsite() {
  storedWebsite = null;
}

module.exports = {
  setWebsite,
  getWebsite,
  clearWebsite,
};

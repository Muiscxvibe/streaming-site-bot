const { ensureUrl } = require('./browser');
const { fetchWithFallback } = require('./flaresolverr');

let config = { host: null, username: null, password: null, cookie: null };

function setQbittorrentConfig(host, username, password) {
  if (!host || !username || !password) {
    throw new Error('Host, username, and password are required to configure qBittorrent.');
  }

  config = {
    host: ensureUrl(host),
    username: username.trim(),
    password: password.trim(),
    cookie: null,
  };
}

function getQbittorrentConfig() {
  return { ...config };
}

function isConfigured() {
  return Boolean(config.host && config.username && config.password);
}

function getApiUrl(path) {
  if (!config.host) throw new Error('qBittorrent host is not configured.');
  const base = new URL(config.host);
  return new URL(path, base).toString();
}

async function login() {
  if (!isConfigured()) {
    throw new Error('qBittorrent is not configured. Use /qbittorrent first.');
  }

  const url = getApiUrl('/api/v2/auth/login');
  const body = new URLSearchParams();
  body.set('username', config.username);
  body.set('password', config.password);

  const response = await fetchWithFallback(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Login failed with status ${response.status}`);
  }

  const cookie = response.headers.get('set-cookie');
  if (!cookie) {
    throw new Error('qBittorrent did not return a session cookie.');
  }

  config.cookie = cookie;
  return cookie;
}

async function ensureSession() {
  if (config.cookie) {
    return config.cookie;
  }

  return login();
}

async function addTorrent(url) {
  if (!url) {
    throw new Error('A torrent or magnet URL is required.');
  }

  await ensureSession();

  const apiUrl = getApiUrl('/api/v2/torrents/add');
  const body = new URLSearchParams();
  body.set('urls', url);

  const response = await fetchWithFallback(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: config.cookie,
    },
    body,
  });

  if (response.status === 403 || response.status === 401) {
    config.cookie = null;
    await ensureSession();
    return addTorrent(url);
  }

  if (!response.ok) {
    throw new Error(`Failed to add torrent: ${response.status}`);
  }

  return true;
}

module.exports = {
  setQbittorrentConfig,
  getQbittorrentConfig,
  isConfigured,
  addTorrent,
  login,
};

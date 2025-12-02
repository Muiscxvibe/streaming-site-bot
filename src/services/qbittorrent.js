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

async function fetchWithSession(url, options = {}, retry = true) {
  await ensureSession();

  const response = await fetchWithFallback(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Cookie: config.cookie,
    },
  });

  if ((response.status === 401 || response.status === 403) && retry) {
    config.cookie = null;
    await ensureSession();
    return fetchWithSession(url, options, false);
  }

  return response;
}

async function addTorrent(url, { savePath, tag } = {}) {
  if (!url) {
    throw new Error('A torrent or magnet URL is required.');
  }

  await ensureSession();

  const apiUrl = getApiUrl('/api/v2/torrents/add');
  const body = new URLSearchParams();
  body.set('urls', url);

  if (savePath) {
    body.set('savepath', savePath);
    body.set('autoTMM', 'false');
  }

  if (tag) {
    body.set('tags', tag);
  }

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
    return addTorrent(url, { savePath });
  }

  if (!response.ok) {
    throw new Error(`Failed to add torrent: ${response.status}`);
  }

  return true;
}

async function getTorrentByTag(tag) {
  if (!tag) {
    throw new Error('A tag is required to look up torrent progress.');
  }

  const url = getApiUrl(`/api/v2/torrents/info?tag=${encodeURIComponent(tag)}`);
  const response = await fetchWithSession(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(`Failed to fetch torrent info: ${response.status}`);
  }

  const torrents = await response.json();
  const normalizedTag = String(tag).trim();

  return (torrents || []).find((torrent) => {
    const tags = (torrent.tags || '').split(',').map((entry) => entry.trim()).filter(Boolean);
    return tags.includes(normalizedTag);
  });
}

module.exports = {
  setQbittorrentConfig,
  getQbittorrentConfig,
  isConfigured,
  addTorrent,
  getTorrentByTag,
  login,
};

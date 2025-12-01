const { ensureUrl } = require('./browser');

async function fetchWithFallback(...args) {
  if (typeof global.fetch === 'function') {
    return global.fetch(...args);
  }

  const { default: nodeFetch } = await import('node-fetch');
  return nodeFetch(...args);
}

const DEFAULT_ENDPOINT = process.env.FLARESOLVERR_URL || '';
const DEFAULT_TIMEOUT_MS = 60000;

function sanitizeEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== 'string') {
    return '';
  }

  return endpoint.replace(/\/$/, '');
}

async function openWithFlareSolverr(target, endpoint = DEFAULT_ENDPOINT) {
  const url = ensureUrl(target);
  const baseEndpoint = sanitizeEndpoint(endpoint);

  if (!baseEndpoint) {
    throw new Error('FlareSolverr URL is not configured. Set FLARESOLVERR_URL.');
  }

  const response = await fetchWithFallback(`${baseEndpoint}/v1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cmd: 'request.get',
      url,
      maxTimeout: DEFAULT_TIMEOUT_MS,
    }),
  });

  if (!response.ok) {
    throw new Error(`FlareSolverr responded with status ${response.status}.`);
  }

  const payload = await response.json();

  if (payload.status !== 'ok') {
    throw new Error(payload.message || 'FlareSolverr did not return an ok status.');
  }

  const solvedUrl = payload.solution?.url || url;
  return { url: solvedUrl, endpoint: baseEndpoint };
}

async function fetchPageWithFlareSolverr(target, endpoint = DEFAULT_ENDPOINT) {
  const url = ensureUrl(target);
  const baseEndpoint = sanitizeEndpoint(endpoint);

  if (!baseEndpoint) {
    throw new Error('FlareSolverr URL is not configured. Set FLARESOLVERR_URL.');
  }

  const response = await fetchWithFallback(`${baseEndpoint}/v1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cmd: 'request.get',
      url,
      maxTimeout: DEFAULT_TIMEOUT_MS,
    }),
  });

  if (!response.ok) {
    throw new Error(`FlareSolverr responded with status ${response.status}.`);
  }

  const payload = await response.json();

  if (payload.status !== 'ok') {
    throw new Error(payload.message || 'FlareSolverr did not return an ok status.');
  }

  const solvedUrl = payload.solution?.url || url;
  const html = payload.solution?.response || '';

  return { url: solvedUrl, html, endpoint: baseEndpoint };
}

module.exports = {
  openWithFlareSolverr,
  sanitizeEndpoint,
  DEFAULT_ENDPOINT,
  fetchWithFallback,
  fetchPageWithFlareSolverr,
};

const { randomUUID } = require('crypto');

const resultMap = new Map();
const TTL_MS = 15 * 60 * 1000; // 15 minutes

function saveResults(results, options = {}) {
  const token = randomUUID();
  resultMap.set(token, { results, options, createdAt: Date.now() });
  return token;
}

function getResult(token, index) {
  const entry = resultMap.get(token);
  if (!entry) return null;

  if (Date.now() - entry.createdAt > TTL_MS) {
    resultMap.delete(token);
    return null;
  }

  const result = entry.results[index];
  if (!result) return null;

  return { result, options: entry.options };
}

function clearToken(token) {
  resultMap.delete(token);
}

module.exports = { saveResults, getResult, clearToken };

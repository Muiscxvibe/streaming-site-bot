const fetch = global.fetch || require('node-fetch');

async function fetchGoogleSuggestion(query) {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) return null;

    const data = await response.json();
    if (Array.isArray(data) && Array.isArray(data[1]) && data[1][0]) {
      return String(data[1][0]);
    }
  } catch (error) {
    console.warn('[autocorrect] Failed to fetch suggestion', error.message);
  }

  return null;
}

function normalizeTitleCase(text) {
  return text
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function fetchShowSeasonCount(title) {
  const query = `${title} number of seasons`;

  try {
    const url = `https://www.google.com/search?client=firefox&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

    if (!response.ok) return null;

    const body = await response.text();
    const match = body.match(/(\d+)\s+seasons?/i);

    if (match) {
      const count = Number.parseInt(match[1], 10);
      if (!Number.isNaN(count) && count > 0) {
        return count;
      }
    }
  } catch (error) {
    console.warn('[autocorrect] Failed to fetch season count', error.message);
  }

  return null;
}

async function autocorrectTitle(input) {
  const trimmed = input.trim();
  if (!trimmed) return { original: input, corrected: input, suggestion: null };

  const basic = normalizeTitleCase(trimmed);
  const suggestion = await fetchGoogleSuggestion(trimmed);

  if (suggestion && suggestion.toLowerCase() !== trimmed.toLowerCase()) {
    return { original: trimmed, corrected: normalizeTitleCase(suggestion), suggestion };
  }

  return { original: trimmed, corrected: basic, suggestion: null };
}

module.exports = { autocorrectTitle, fetchShowSeasonCount };

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

module.exports = { autocorrectTitle };

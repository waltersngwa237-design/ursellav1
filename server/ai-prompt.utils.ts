/**
 * Server utility functions for AI prompt formatting and follow-up suggestion normalization.
 */

export function sanitizeFollowUpSuggestion(suggestion: string): string {
  if (!suggestion || typeof suggestion !== 'string') return '';
  let clean = suggestion.trim();

  // Strip leading AI conversational inquiry frames
  clean = clean
    .replace(/^would you like me to\s+/i, '')
    .replace(/^would you like to\s+/i, '')
    .replace(/^would you like\s+/i, 'Show me ')
    .replace(/^do you want me to\s+/i, '')
    .replace(/^do you want to\s+/i, '')
    .replace(/^do you want\s+/i, 'Show me ')
    .replace(/^should i\s+/i, '')
    .replace(/^shall i\s+/i, '')
    .replace(/^can i help you\s+/i, 'Help me ')
    .replace(/^can i\s+/i, '')
    .replace(/^do you need me to\s+/i, '')
    .replace(/^do you need help\s+(?:with|to)?\s*/i, 'Help me ')
    .replace(/^do you need to\s+/i, '')
    .replace(/^do you have any questions about\s+/i, 'Tell me more about ')
    .replace(/^let me know if you want to\s+/i, '')
    .replace(/^if you want, I can\s+/i, '')
    .trim();

  if (!clean) return '';

  clean = clean.charAt(0).toUpperCase() + clean.slice(1);

  if (clean.endsWith('?') && !/^(how|what|who|which|where|why|can you|is|are)\b/i.test(clean)) {
    clean = clean.slice(0, -1).trim();
  }

  return clean;
}

export function sanitizeFollowUpSuggestions(suggestions: unknown): string[] {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return ['How are my sales today?', 'Which products are low on stock?'];
  }

  const cleaned = suggestions
    .map((s) => sanitizeFollowUpSuggestion(s))
    .filter((s) => s.length > 3);

  return cleaned.length > 0
    ? cleaned.slice(0, 4)
    : ['How are my sales today?', 'Which products are low on stock?'];
}

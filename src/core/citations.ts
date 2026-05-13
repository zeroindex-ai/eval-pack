import type { CitationExtractor } from './schema.js';

// ============================================================================
// Citation extractors
// ============================================================================
// A CitationExtractor pulls citation refs out of an answer's text. The two
// shipped extractors cover the common cases; users supply their own for
// anything else (structured tool calls, JSON-mode output, etc).

/**
 * Build an extractor that pulls citation refs from text using a global regex
 * whose first capture group is the citation ref. Dedupes refs.
 *
 * Example: `markerCitationExtractor(/\[chunk:(\d+)\]/g)` matches `[chunk:3]`
 * and returns `["3"]`.
 *
 * The regex MUST have the `g` flag — String.prototype.matchAll requires it.
 */
export function markerCitationExtractor(pattern: RegExp): CitationExtractor {
  if (!pattern.global) {
    throw new Error(
      `markerCitationExtractor: regex must have the 'g' flag (received ${pattern.toString()})`,
    );
  }
  return (text) => {
    const refs = new Set<string>();
    for (const m of text.matchAll(pattern)) {
      const ref = m[1];
      if (ref !== undefined) refs.add(ref);
    }
    return Array.from(refs);
  };
}

/**
 * Extractor that returns no citations regardless of input. Use when the
 * subject doesn't emit citations (chat without grounding, agent without
 * tool-call surfacing, etc.) — paired with `citationCount({ min: 0 })` or
 * with `citationCount({ ..., skipWhen })` to keep the check meaningful.
 */
export const noopCitationExtractor: CitationExtractor = () => [];

import { describe, it, expect } from 'vitest';
import { markerCitationExtractor, noopCitationExtractor } from './citations.js';

describe('markerCitationExtractor', () => {
  it('extracts refs matching a [chunk:N] pattern', () => {
    const extract = markerCitationExtractor(/\[chunk:(\d+)\]/g);
    expect(extract('Services include [chunk:1] and [chunk:21].')).toEqual(['1', '21']);
  });

  it('dedupes repeated refs', () => {
    const extract = markerCitationExtractor(/\[chunk:(\d+)\]/g);
    expect(extract('See [chunk:1], also [chunk:1] and [chunk:2].')).toEqual(['1', '2']);
  });

  it('returns an empty array when nothing matches', () => {
    const extract = markerCitationExtractor(/\[chunk:(\d+)\]/g);
    expect(extract('No citations here.')).toEqual([]);
    expect(extract('')).toEqual([]);
  });

  it('works with a non-numeric pattern (e.g. doc URIs)', () => {
    const extract = markerCitationExtractor(/\[doc:([a-z0-9-]+)\]/g);
    expect(extract('See [doc:intro] and [doc:pricing-v2].')).toEqual(['intro', 'pricing-v2']);
  });

  it('preserves first-encounter order', () => {
    const extract = markerCitationExtractor(/\[chunk:(\d+)\]/g);
    expect(extract('first [chunk:5], then [chunk:2], then [chunk:5] again, then [chunk:9]')).toEqual([
      '5',
      '2',
      '9',
    ]);
  });

  it('throws a clear error when the regex lacks the global flag', () => {
    expect(() => markerCitationExtractor(/\[chunk:(\d+)\]/)).toThrow(/must have the 'g' flag/);
  });

  it('is safe to call multiple times with the same extractor (no shared state)', () => {
    const extract = markerCitationExtractor(/\[chunk:(\d+)\]/g);
    expect(extract('a [chunk:1] b')).toEqual(['1']);
    expect(extract('c [chunk:2] d')).toEqual(['2']);
    expect(extract('e [chunk:1] f [chunk:2] g')).toEqual(['1', '2']);
  });
});

describe('noopCitationExtractor', () => {
  it('always returns an empty array', () => {
    expect(noopCitationExtractor('')).toEqual([]);
    expect(noopCitationExtractor('lots of text with [chunk:1] and [doc:foo]')).toEqual([]);
  });
});

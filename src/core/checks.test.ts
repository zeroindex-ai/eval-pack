import { describe, it, expect } from 'vitest';
import { mustMention, mustNotMention, citationCount, expectRefusal } from './checks.js';
import type { GoldenItem, PartialResult } from './schema.js';

function makeResult(overrides: Partial<PartialResult> = {}): PartialResult {
  return {
    id: 'test',
    category: 'positive',
    question: 'what?',
    text: '',
    retrievedRefs: [],
    citationRefs: [],
    recallAtK: null,
    timings: { totalMs: 0 },
    metadata: {},
    ...overrides,
  };
}

function makeItem(overrides: Partial<GoldenItem> = {}): GoldenItem {
  return {
    id: 'q1',
    category: 'positive',
    question: 'what?',
    ...overrides,
  };
}

describe('mustMention', () => {
  it('passes when all terms appear (case-insensitive by default)', () => {
    const item = makeItem({ must_mention: ['audit', 'BUILD'] });
    const result = makeResult({ text: 'We offer Audit and build services.' });
    const out = mustMention()(item, result);
    expect(out.ok).toBe(true);
    expect(out.detail).toBeUndefined();
  });

  it('passes vacuously when must_mention is absent', () => {
    const out = mustMention()(makeItem(), makeResult({ text: 'anything' }));
    expect(out.ok).toBe(true);
  });

  it('passes vacuously when must_mention is empty array', () => {
    const out = mustMention()(makeItem({ must_mention: [] }), makeResult());
    expect(out.ok).toBe(true);
  });

  it('fails when at least one term is missing and reports it', () => {
    const item = makeItem({ must_mention: ['audit', 'invoice'] });
    const result = makeResult({ text: 'We offer audit and build services.' });
    const out = mustMention()(item, result);
    expect(out.ok).toBe(false);
    expect(out.detail).toEqual({ missing: ['invoice'] });
  });

  it('respects caseSensitive: true', () => {
    const item = makeItem({ must_mention: ['Audit'] });
    const lower = makeResult({ text: 'we offer audit services' });
    const exact = makeResult({ text: 'we offer Audit services' });
    expect(mustMention({ caseSensitive: true })(item, lower).ok).toBe(false);
    expect(mustMention({ caseSensitive: true })(item, exact).ok).toBe(true);
  });
});

describe('mustNotMention', () => {
  it('passes when no forbidden terms appear', () => {
    const item = makeItem({ must_not_mention: ['hallucination', 'fake'] });
    const result = makeResult({ text: 'Clean grounded answer.' });
    const out = mustNotMention()(item, result);
    expect(out.ok).toBe(true);
    expect(out.detail).toBeUndefined();
  });

  it('passes vacuously when must_not_mention is absent', () => {
    expect(mustNotMention()(makeItem(), makeResult({ text: 'anything' })).ok).toBe(true);
  });

  it('fails when a forbidden term appears (case-insensitive by default) and reports it', () => {
    const item = makeItem({ must_not_mention: ['HALLUCINATION', 'guess'] });
    const result = makeResult({ text: 'Possibly a hallucination.' });
    const out = mustNotMention()(item, result);
    expect(out.ok).toBe(false);
    expect(out.detail).toEqual({ found: ['HALLUCINATION'] });
  });

  it('respects caseSensitive: true', () => {
    const item = makeItem({ must_not_mention: ['EvilGPT'] });
    const lower = makeResult({ text: 'about evilgpt persona' });
    const exact = makeResult({ text: 'about EvilGPT persona' });
    expect(mustNotMention({ caseSensitive: true })(item, lower).ok).toBe(true);
    expect(mustNotMention({ caseSensitive: true })(item, exact).ok).toBe(false);
  });
});

describe('citationCount', () => {
  it('passes when citationRefs length >= min', () => {
    const out = citationCount({ min: 1 })(makeItem(), makeResult({ citationRefs: ['c1', 'c2'] }));
    expect(out.ok).toBe(true);
    expect(out.detail).toEqual({ count: 2, min: 1 });
  });

  it('fails when citationRefs length < min', () => {
    const out = citationCount({ min: 2 })(makeItem(), makeResult({ citationRefs: ['c1'] }));
    expect(out.ok).toBe(false);
    expect(out.detail).toEqual({ count: 1, min: 2 });
  });

  it('skips and passes when skipWhen returns true', () => {
    const item = makeItem({ expect_refusal: true });
    const out = citationCount({
      min: 1,
      skipWhen: (i) => i.expect_refusal === true,
    })(item, makeResult({ citationRefs: [] }));
    expect(out.ok).toBe(true);
    expect(out.detail).toEqual({ skipped: true });
  });

  it('does not skip when skipWhen returns false', () => {
    const item = makeItem({ expect_refusal: false });
    const out = citationCount({
      min: 1,
      skipWhen: (i) => i.expect_refusal === true,
    })(item, makeResult({ citationRefs: [] }));
    expect(out.ok).toBe(false);
  });
});

describe('expectRefusal', () => {
  it('skips when item.expect_refusal is undefined', () => {
    const out = expectRefusal()(makeItem(), makeResult({ text: 'anything' }));
    expect(out.ok).toBe(true);
    expect(out.detail).toEqual({ skipped: true });
  });

  it('passes when expected refusal and text contains a default refusal phrase', () => {
    const item = makeItem({ expect_refusal: true });
    const result = makeResult({ text: "I don't have information about that topic." });
    const out = expectRefusal()(item, result);
    expect(out.ok).toBe(true);
    expect(out.detail).toEqual({ expected: true, actual: true });
  });

  it('fails when expected refusal but text does not refuse', () => {
    const item = makeItem({ expect_refusal: true });
    const result = makeResult({ text: 'Here is a confident answer.' });
    const out = expectRefusal()(item, result);
    expect(out.ok).toBe(false);
    expect(out.detail).toEqual({ expected: true, actual: false });
  });

  it('passes when expect_refusal: false and answer is non-refusal', () => {
    const item = makeItem({ expect_refusal: false });
    const result = makeResult({ text: 'Confident grounded answer.' });
    expect(expectRefusal()(item, result).ok).toBe(true);
  });

  it('fails when expect_refusal: false but answer refuses anyway', () => {
    const item = makeItem({ expect_refusal: false });
    const result = makeResult({ text: "I'm unable to help with that." });
    const out = expectRefusal()(item, result);
    expect(out.ok).toBe(false);
    expect(out.detail).toEqual({ expected: false, actual: true });
  });

  it('accepts a custom phrase list (overrides defaults entirely)', () => {
    const item = makeItem({ expect_refusal: true });
    const fancy = makeResult({ text: 'This falls outside my knowledge frame.' });
    const defaults = makeResult({ text: "i don't know" });
    expect(expectRefusal()(item, fancy).ok).toBe(false);
    expect(expectRefusal({ phrases: ['outside my knowledge frame'] })(item, fancy).ok).toBe(true);
    expect(expectRefusal({ phrases: ['outside my knowledge frame'] })(item, defaults).ok).toBe(false);
  });
});

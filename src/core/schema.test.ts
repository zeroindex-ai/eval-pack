import { describe, it, expect } from 'vitest';
import { GoldenItemSchema, GoldenSetSchema, JudgmentSchema } from './schema.js';

describe('GoldenItemSchema', () => {
  it('accepts a minimal item (only required fields)', () => {
    const item = { id: 'q1', category: 'positive', question: 'what?' };
    expect(GoldenItemSchema.parse(item)).toEqual(item);
  });

  it('accepts an item with all optional fields populated', () => {
    const item = {
      id: 'q1',
      category: 'positive',
      question: 'what?',
      relevant_refs: ['1', '2'],
      must_mention: ['answer'],
      must_not_mention: ['hallucination'],
      expect_refusal: false,
      tags: ['services'],
      metadata: { custom: 'whatever' },
    };
    expect(GoldenItemSchema.parse(item)).toEqual(item);
  });

  it('rejects items missing required fields', () => {
    expect(() => GoldenItemSchema.parse({ id: 'q1', category: 'positive' })).toThrow();
    expect(() => GoldenItemSchema.parse({ id: 'q1', question: 'what?' })).toThrow();
    expect(() => GoldenItemSchema.parse({ category: 'positive', question: 'what?' })).toThrow();
  });

  it('rejects relevant_refs containing non-strings (must be opaque refs)', () => {
    expect(() =>
      GoldenItemSchema.parse({
        id: 'q1',
        category: 'positive',
        question: 'what?',
        relevant_refs: [1, 2],
      })
    ).toThrow();
  });
});

describe('GoldenSetSchema', () => {
  it('accepts a valid v1.0 set with empty items', () => {
    expect(GoldenSetSchema.parse({ version: '1.0', items: [] })).toEqual({
      version: '1.0',
      items: [],
    });
  });

  it('accepts a valid v1.0 set with items', () => {
    const set = {
      version: '1.0' as const,
      items: [{ id: 'q1', category: 'positive', question: 'what?' }],
    };
    expect(GoldenSetSchema.parse(set)).toEqual(set);
  });

  it('rejects a set with a wrong version (forward compat boundary)', () => {
    expect(() => GoldenSetSchema.parse({ version: '2.0', items: [] })).toThrow();
    expect(() => GoldenSetSchema.parse({ version: 1.0, items: [] })).toThrow();
  });

  it('rejects a set missing the version wrapper', () => {
    expect(() => GoldenSetSchema.parse([{ id: 'q1', category: 'positive', question: 'what?' }])).toThrow();
  });
});

describe('JudgmentSchema', () => {
  it('accepts a valid judgment object', () => {
    const j = { appropriate: 'yes' as const, grounded: 'yes' as const, reason: 'looks good' };
    expect(JudgmentSchema.parse(j)).toEqual(j);
  });

  it('accepts grounded: "na" (refusal case)', () => {
    const j = {
      appropriate: 'yes' as const,
      grounded: 'na' as const,
      reason: 'refusal was correct',
    };
    expect(JudgmentSchema.parse(j)).toEqual(j);
  });

  it('rejects unknown enum values', () => {
    expect(() => JudgmentSchema.parse({ appropriate: 'maybe', grounded: 'yes', reason: 'x' })).toThrow();
    expect(() => JudgmentSchema.parse({ appropriate: 'yes', grounded: 'unsure', reason: 'x' })).toThrow();
  });

  it('rejects missing fields', () => {
    expect(() => JudgmentSchema.parse({ appropriate: 'yes', reason: 'x' })).toThrow();
    expect(() => JudgmentSchema.parse({ appropriate: 'yes', grounded: 'yes' })).toThrow();
  });
});

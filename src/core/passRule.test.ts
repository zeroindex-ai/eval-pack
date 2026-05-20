import { describe, it, expect } from 'vitest';
import { defaultPassRule, byCategory } from './passRule.js';
import type { Result } from './schema.js';

function makeResult(overrides: Partial<Result> = {}): Result {
  return {
    id: 'test',
    category: 'positive',
    question: 'what?',
    text: '',
    retrievedRefs: [],
    citationRefs: [],
    recall: null,
    timings: { totalMs: 0 },
    metadata: {},
    checks: [],
    judgment: null,
    pass: false,
    ...overrides,
  };
}

describe('defaultPassRule', () => {
  it('passes when all checks ok and no judge', () => {
    expect(
      defaultPassRule(
        makeResult({
          checks: [
            { name: 'a', ok: true },
            { name: 'b', ok: true },
          ],
          judgment: null,
        })
      )
    ).toBe(true);
  });

  it('fails when any check fails (even without judge)', () => {
    expect(
      defaultPassRule(
        makeResult({
          checks: [
            { name: 'a', ok: true },
            { name: 'b', ok: false },
          ],
          judgment: null,
        })
      )
    ).toBe(false);
  });

  it('passes when checks ok + appropriate=yes + grounded=yes', () => {
    expect(
      defaultPassRule(
        makeResult({
          checks: [{ name: 'a', ok: true }],
          judgment: { appropriate: 'yes', grounded: 'yes', reason: '' },
        })
      )
    ).toBe(true);
  });

  it('passes when grounded=na (refusal-as-correct-behavior)', () => {
    expect(
      defaultPassRule(
        makeResult({
          checks: [],
          judgment: { appropriate: 'yes', grounded: 'na', reason: 'refusal correct' },
        })
      )
    ).toBe(true);
  });

  it('fails when judge says appropriate=no', () => {
    expect(
      defaultPassRule(
        makeResult({
          checks: [],
          judgment: { appropriate: 'no', grounded: 'yes', reason: '' },
        })
      )
    ).toBe(false);
  });

  it('fails when judge says appropriate=partial', () => {
    expect(
      defaultPassRule(
        makeResult({
          checks: [],
          judgment: { appropriate: 'partial', grounded: 'yes', reason: '' },
        })
      )
    ).toBe(false);
  });

  it('fails when judge says grounded=no', () => {
    expect(
      defaultPassRule(
        makeResult({
          checks: [],
          judgment: { appropriate: 'yes', grounded: 'no', reason: '' },
        })
      )
    ).toBe(false);
  });

  it('passes vacuously when checks empty and no judge', () => {
    expect(defaultPassRule(makeResult({ checks: [], judgment: null }))).toBe(true);
  });
});

describe('byCategory', () => {
  it('dispatches to the category-matching rule', () => {
    const rule = byCategory({
      positive: () => true,
      negative: () => false,
    });
    expect(rule(makeResult({ category: 'positive' }))).toBe(true);
    expect(rule(makeResult({ category: 'negative' }))).toBe(false);
  });

  it('falls back to the `default` key when no category matches', () => {
    const rule = byCategory({
      positive: () => true,
      default: () => false,
    });
    expect(rule(makeResult({ category: 'adversarial' }))).toBe(false);
  });

  it('falls back to defaultPassRule when no default key is provided', () => {
    const rule = byCategory({ positive: () => false });
    const r = makeResult({
      category: 'adversarial',
      checks: [{ name: 'a', ok: true }],
      judgment: null,
    });
    expect(rule(r)).toBe(true);
  });
});

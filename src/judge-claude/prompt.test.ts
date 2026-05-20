import { describe, it, expect } from 'vitest';
import { buildPrompt, DEFAULT_CATEGORY_GUIDANCE } from './prompt.js';
import type { GoldenItem, PartialResult } from '../core/schema.js';

function makeItem(overrides: Partial<GoldenItem> = {}): GoldenItem {
  return {
    id: 'q1',
    category: 'positive',
    question: 'What services?',
    ...overrides,
  };
}

function makeResult(overrides: Partial<PartialResult> = {}): PartialResult {
  return {
    id: 'q1',
    category: 'positive',
    question: 'What services?',
    text: 'Audit and build.',
    retrievedRefs: [],
    citationRefs: ['1'],
    recall: null,
    timings: { totalMs: 100 },
    metadata: {},
    ...overrides,
  };
}

describe('buildPrompt', () => {
  it('includes the question, category, and JSON-stringified answer text', () => {
    const out = buildPrompt(makeItem(), makeResult(), DEFAULT_CATEGORY_GUIDANCE);
    expect(out).toContain('Original question: "What services?"');
    expect(out).toContain('Category: positive');
    expect(out).toContain('AI answer: "Audit and build."');
  });

  it('embeds the supplied category guidance verbatim', () => {
    const guidance = 'Expected behaviors per category:\n- happy: smile\n- sad: refuse';
    const out = buildPrompt(makeItem(), makeResult(), guidance);
    expect(out).toContain(guidance);
  });

  it('reports citation count from result.citationRefs.length', () => {
    expect(buildPrompt(makeItem(), makeResult({ citationRefs: [] }), '')).toContain('Citation count: 0');
    expect(buildPrompt(makeItem(), makeResult({ citationRefs: ['a', 'b', 'c'] }), '')).toContain(
      'Citation count: 3'
    );
  });

  it('renders expect_refusal: true when set; false when omitted', () => {
    expect(buildPrompt(makeItem({ expect_refusal: true }), makeResult(), '')).toContain(
      'Expect refusal: true'
    );
    expect(buildPrompt(makeItem(), makeResult(), '')).toContain('Expect refusal: false');
  });

  it('JSON-stringifies text with embedded quotes and newlines safely', () => {
    const text = 'a "tricky"\nanswer';
    const out = buildPrompt(makeItem(), makeResult({ text }), '');
    expect(out).toContain('AI answer: "a \\"tricky\\"\\nanswer"');
  });

  it('asks for exactly the JSON shape the JudgmentSchema expects', () => {
    const out = buildPrompt(makeItem(), makeResult(), DEFAULT_CATEGORY_GUIDANCE);
    expect(out).toContain('"appropriate"');
    expect(out).toContain('"grounded"');
    expect(out).toContain('"reason"');
  });
});

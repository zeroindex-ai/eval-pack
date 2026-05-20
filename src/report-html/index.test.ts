import { describe, it, expect } from 'vitest';
import { renderHtml } from './index.js';
import type { Result } from '../core/schema.js';
import type { RunReport } from '../core/runner.js';

function makeResult(overrides: Partial<Result> = {}): Result {
  return {
    id: 'q1',
    category: 'positive',
    question: 'What?',
    text: 'Answer.',
    retrievedRefs: [],
    citationRefs: [],
    recall: null,
    timings: { totalMs: 100 },
    metadata: {},
    checks: [],
    judgment: null,
    pass: true,
    ...overrides,
  };
}

function makeReport(overrides: Partial<RunReport> = {}): RunReport {
  return {
    ran: '2026-05-13T05:00:00Z',
    results: [],
    errors: [],
    ...overrides,
  };
}

describe('renderHtml — structure', () => {
  it('returns a complete HTML document', () => {
    const out = renderHtml(makeReport());
    expect(out).toMatch(/^<!DOCTYPE html>/);
    expect(out).toContain('<html lang="en">');
    expect(out).toContain('</html>');
  });

  it('inlines the stylesheet (no external CSS link)', () => {
    const out = renderHtml(makeReport());
    expect(out).toContain('<style>');
    expect(out).not.toMatch(/<link[^>]*stylesheet/i);
  });

  it('uses projectName in the title when title not provided', () => {
    const out = renderHtml(makeReport(), { projectName: 'demo' });
    expect(out).toContain('<title>demo eval results</title>');
    expect(out).toContain('<h1>demo eval results</h1>');
  });

  it('uses explicit title when provided (overrides projectName)', () => {
    const out = renderHtml(makeReport(), { projectName: 'demo', title: 'Custom Title' });
    expect(out).toContain('<title>Custom Title</title>');
  });
});

describe('renderHtml — headline pass rate', () => {
  it('computes the pass rate from results', () => {
    const out = renderHtml(
      makeReport({
        results: [
          makeResult({ id: 'a', pass: true }),
          makeResult({ id: 'b', pass: true }),
          makeResult({ id: 'c', pass: false }),
          makeResult({ id: 'd', pass: false }),
        ],
      })
    );
    expect(out).toContain('50.0%');
  });

  it('marks pass-rate green (ok class) when threshold met or absent', () => {
    const all = makeReport({
      results: [makeResult({ id: 'a', pass: true })],
    });
    expect(renderHtml(all)).toContain('pass-rate ok');
    expect(renderHtml(all, { threshold: 0.5 })).toContain('pass-rate ok');
  });

  it('marks pass-rate red (bad class) when below threshold', () => {
    const half = makeReport({
      results: [makeResult({ id: 'a', pass: true }), makeResult({ id: 'b', pass: false })],
    });
    expect(renderHtml(half, { threshold: 0.8 })).toContain('pass-rate bad');
  });

  it('renders threshold label when provided', () => {
    const out = renderHtml(makeReport({ results: [makeResult()] }), { threshold: 0.8 });
    expect(out).toContain('threshold 80%');
  });

  it('handles empty results without dividing by zero', () => {
    const out = renderHtml(makeReport());
    expect(out).toContain('0.0%');
  });
});

describe('renderHtml — category table', () => {
  it('renders one row per unique category with passed/total + pct', () => {
    const out = renderHtml(
      makeReport({
        results: [
          makeResult({ id: 'a', category: 'positive', pass: true }),
          makeResult({ id: 'b', category: 'positive', pass: false }),
          makeResult({ id: 'c', category: 'negative', pass: true }),
        ],
      })
    );
    expect(out).toContain('<code>positive</code>');
    expect(out).toContain('1/2');
    expect(out).toContain('50%');
    expect(out).toContain('<code>negative</code>');
    expect(out).toContain('1/1');
    expect(out).toContain('100%');
  });
});

describe('renderHtml — failures section', () => {
  it('shows a failures section with details for each failing item', () => {
    const out = renderHtml(
      makeReport({
        results: [
          makeResult({ id: 'fail-1', pass: false, text: 'broken answer' }),
          makeResult({ id: 'pass-1', pass: true }),
        ],
      })
    );
    expect(out).toContain('<h2>Failures (1)</h2>');
    expect(out).toContain('<code>fail-1</code>');
    expect(out).toContain('broken answer');
  });

  it('omits the failures section when every item passed', () => {
    const out = renderHtml(makeReport({ results: [makeResult()] }));
    expect(out).not.toContain('Failures (');
  });
});

describe('renderHtml — passing section (collapsed)', () => {
  it('renders a collapsed details with a per-item row table', () => {
    const out = renderHtml(
      makeReport({
        results: [makeResult({ id: 'pass-1' }), makeResult({ id: 'pass-2' })],
      })
    );
    expect(out).toContain('<h2>Passing (2)</h2>');
    expect(out).toContain('<code>pass-1</code>');
    expect(out).toContain('<code>pass-2</code>');
  });
});

describe('renderHtml — errors section', () => {
  it('renders an errors table when report.errors is non-empty', () => {
    const out = renderHtml(makeReport({ errors: [{ id: 'boom', error: 'fetch failed' }] }));
    expect(out).toContain('<h2>Errors (1)</h2>');
    expect(out).toContain('<code>boom</code>');
    expect(out).toContain('fetch failed');
  });

  it('omits the errors section when there are none', () => {
    expect(renderHtml(makeReport())).not.toContain('Errors (');
  });
});

describe('renderHtml — escaping', () => {
  it('escapes HTML in answer text', () => {
    const out = renderHtml(
      makeReport({
        results: [makeResult({ pass: false, text: '<script>alert("xss")</script>' })],
      })
    );
    expect(out).not.toContain('<script>alert');
    expect(out).toContain('&lt;script&gt;alert');
  });

  it('escapes HTML in judge reason', () => {
    const out = renderHtml(
      makeReport({
        results: [
          makeResult({
            pass: false,
            judgment: { appropriate: 'no', grounded: 'no', reason: '<bad>tag</bad>' },
          }),
        ],
      })
    );
    expect(out).not.toContain('<bad>tag</bad>');
    expect(out).toContain('&lt;bad&gt;tag&lt;/bad&gt;');
  });
});

describe('renderHtml — redact hook', () => {
  it('applies redact to every result before rendering', () => {
    const out = renderHtml(
      makeReport({
        results: [makeResult({ pass: false, text: 'sensitive content' })],
      }),
      { redact: (r) => ({ ...r, text: '[REDACTED]' }) }
    );
    expect(out).not.toContain('sensitive content');
    expect(out).toContain('[REDACTED]');
  });
});

describe('renderHtml — judge metadata', () => {
  it('shows judgeName in the header when set', () => {
    const out = renderHtml(makeReport({ judgeName: 'claude-judge(claude-sonnet-4-6)' }));
    expect(out).toContain('claude-judge(claude-sonnet-4-6)');
  });

  it('shows "none" when no judge was used', () => {
    const out = renderHtml(makeReport());
    expect(out).toContain('<code>none</code>');
  });
});

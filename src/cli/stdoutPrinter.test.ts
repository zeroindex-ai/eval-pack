import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printSummary } from './stdoutPrinter.js';
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

describe('printSummary', () => {
  let logs: string[] = [];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map((a) => String(a)).join(' '));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders pass-rate header by category', () => {
    printSummary(
      makeReport({
        results: [
          makeResult({ id: 'a', category: 'positive', pass: true }),
          makeResult({ id: 'b', category: 'positive', pass: false }),
          makeResult({ id: 'c', category: 'negative', pass: true }),
        ],
      }),
      undefined
    );
    const text = logs.join('\n');
    expect(text).toContain('Pass rate by category');
    expect(text).toContain('positive');
    expect(text).toMatch(/1\/2 \(50%\)/);
    expect(text).toContain('negative');
    expect(text).toMatch(/1\/1 \(100%\)/);
    expect(text).toContain('TOTAL');
    expect(text).toMatch(/2\/3 \(66\.7%\)/);
  });

  it('prints threshold line when provided', () => {
    printSummary(makeReport({ results: [makeResult()] }), 0.8);
    expect(logs.join('\n')).toContain('Threshold: 80%');
  });

  it('skips threshold line when not provided', () => {
    printSummary(makeReport({ results: [makeResult()] }), undefined);
    expect(logs.join('\n')).not.toContain('Threshold:');
  });

  it('prints failures section with reasons when items failed', () => {
    printSummary(
      makeReport({
        results: [
          makeResult({
            id: 'fail-1',
            pass: false,
            checks: [{ name: 'must_mention', ok: false, detail: { missing: ['audit'] } }],
            judgment: { appropriate: 'no', grounded: 'no', reason: 'off-topic' },
          }),
        ],
      }),
      undefined
    );
    const text = logs.join('\n');
    expect(text).toContain('Failures (1)');
    expect(text).toContain('fail-1');
    expect(text).toContain('must_mention');
    expect(text).toContain('off-topic');
  });

  it('prints errors section when present', () => {
    printSummary(makeReport({ errors: [{ id: 'boom', error: 'fetch failed' }] }), undefined);
    expect(logs.join('\n')).toContain('Errors (1)');
    expect(logs.join('\n')).toContain('boom');
    expect(logs.join('\n')).toContain('fetch failed');
  });

  it('prints saved JSON path when persisted', () => {
    printSummary(makeReport({ jsonPath: 'evals/results/run-foo.json' }), undefined);
    expect(logs.join('\n')).toContain('Saved: evals/results/run-foo.json');
  });

  it('handles empty results without dividing by zero', () => {
    printSummary(makeReport(), undefined);
    expect(logs.join('\n')).toContain('0/0 (0.0%)');
  });
});

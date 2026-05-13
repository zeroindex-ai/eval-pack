import { describe, it, expect } from 'vitest';
import { parseArgs, UsageError } from './parseArgs.js';

describe('parseArgs — basics', () => {
  it('returns defaults on empty argv', () => {
    const out = parseArgs([]);
    expect(out.filter).toEqual({});
    expect(out.quiet).toBe(false);
    expect(out.help).toBe(false);
    expect(out.subject).toBeUndefined();
  });

  it('parses --flag value form', () => {
    const out = parseArgs(['--subject', './sub.js', '--golden', './g.json']);
    expect(out.subject).toBe('./sub.js');
    expect(out.golden).toBe('./g.json');
  });

  it('parses --flag=value form', () => {
    const out = parseArgs(['--subject=./sub.js', '--golden=./g.json']);
    expect(out.subject).toBe('./sub.js');
    expect(out.golden).toBe('./g.json');
  });

  it('mixes both forms in the same argv', () => {
    const out = parseArgs(['--subject', './sub.js', '--golden=./g.json']);
    expect(out.subject).toBe('./sub.js');
    expect(out.golden).toBe('./g.json');
  });
});

describe('parseArgs — boolean flags', () => {
  it('parses --quiet', () => {
    expect(parseArgs(['--quiet']).quiet).toBe(true);
  });

  it('parses --help and -h', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
  });
});

describe('parseArgs — validation', () => {
  it('throws on unknown flag', () => {
    expect(() => parseArgs(['--unknown', 'value'])).toThrow(UsageError);
    expect(() => parseArgs(['--unknown', 'value'])).toThrow(/Unknown flag/);
  });

  it('throws when a value-taking flag is missing its value', () => {
    expect(() => parseArgs(['--subject'])).toThrow(/Missing value/);
  });

  it('throws when a value-taking flag is followed by another flag', () => {
    expect(() => parseArgs(['--subject', '--golden', 'g'])).toThrow(/Missing value/);
  });

  it('rejects --judge values other than claude or none', () => {
    expect(() => parseArgs(['--judge', 'gpt-4'])).toThrow(/must be "claude" or "none"/);
  });

  it('accepts --judge=claude and --judge=none', () => {
    expect(parseArgs(['--judge', 'claude']).judge).toBe('claude');
    expect(parseArgs(['--judge=none']).judge).toBe('none');
  });

  it('validates --threshold is in [0,1]', () => {
    expect(parseArgs(['--threshold', '0.8']).threshold).toBeCloseTo(0.8);
    expect(() => parseArgs(['--threshold', '1.5'])).toThrow(/in \[0,1\]/);
    expect(() => parseArgs(['--threshold', '-0.1'])).toThrow(/in \[0,1\]/);
    expect(() => parseArgs(['--threshold', 'abc'])).toThrow(/in \[0,1\]/);
  });

  it('validates --limit is a positive integer', () => {
    expect(parseArgs(['--limit', '5']).limit).toBe(5);
    expect(() => parseArgs(['--limit', '0'])).toThrow(/positive integer/);
    expect(() => parseArgs(['--limit', '1.5'])).toThrow(/positive integer/);
    expect(() => parseArgs(['--limit', 'abc'])).toThrow(/positive integer/);
  });

  it('validates --throttle-ms is non-negative', () => {
    expect(parseArgs(['--throttle-ms', '500']).throttleMs).toBe(500);
    expect(parseArgs(['--throttle-ms', '0']).throttleMs).toBe(0);
    expect(() => parseArgs(['--throttle-ms', '-100'])).toThrow(/non-negative/);
  });

  it('--filter requires key=value', () => {
    expect(() => parseArgs(['--filter', 'novaluehere'])).toThrow(/must be key=value/);
    expect(() => parseArgs(['--filter', '=novalue'])).toThrow(/must be key=value/);
  });

  it('repeated --filter accumulates into the filter record', () => {
    const out = parseArgs([
      '--filter',
      'category=positive',
      '--filter',
      'tags=core,smoke',
    ]);
    expect(out.filter).toEqual({ category: 'positive', tags: 'core,smoke' });
  });
});

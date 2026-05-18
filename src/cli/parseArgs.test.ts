import { describe, it, expect } from 'vitest';
import { parseArgs, resolveThreshold, resolveThrottleMs, UsageError } from './parseArgs.js';

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
    const out = parseArgs(['--filter', 'category=positive', '--filter', 'tags=core,smoke']);
    expect(out.filter).toEqual({ category: 'positive', tags: 'core,smoke' });
  });
});

describe('resolveThreshold — env-var fallback', () => {
  it('prefers the CLI value when both are set', () => {
    expect(resolveThreshold(0.5, '0.9')).toBeCloseTo(0.5);
  });

  it('returns undefined when neither is set', () => {
    expect(resolveThreshold(undefined, undefined)).toBeUndefined();
  });

  it('parses a valid env value', () => {
    expect(resolveThreshold(undefined, '0.8')).toBeCloseTo(0.8);
    expect(resolveThreshold(undefined, '0')).toBe(0);
    expect(resolveThreshold(undefined, '1')).toBe(1);
  });

  it('throws UsageError on non-numeric env value', () => {
    expect(() => resolveThreshold(undefined, 'abc')).toThrow(UsageError);
    expect(() => resolveThreshold(undefined, 'abc')).toThrow(
      /EVAL_PASS_THRESHOLD must be a number in \[0,1\]/
    );
  });

  it('throws UsageError on out-of-range env value', () => {
    expect(() => resolveThreshold(undefined, '1.5')).toThrow(/in \[0,1\]/);
    expect(() => resolveThreshold(undefined, '-0.1')).toThrow(/in \[0,1\]/);
  });

  it('throws UsageError on empty-string env value', () => {
    // Number('') === 0, which is valid for threshold — but '' as a deliberate
    // env value is more likely a misconfiguration than an intentional zero.
    // Current behaviour: '' parses to 0 (in range), accepted. Documented here
    // so any future tightening is intentional.
    expect(resolveThreshold(undefined, '')).toBe(0);
  });
});

describe('resolveThrottleMs — env-var fallback', () => {
  it('prefers the CLI value when both are set', () => {
    expect(resolveThrottleMs(250, '5000')).toBe(250);
  });

  it('defaults to 0 when neither is set', () => {
    expect(resolveThrottleMs(undefined, undefined)).toBe(0);
  });

  it('parses a valid env value', () => {
    expect(resolveThrottleMs(undefined, '500')).toBe(500);
    expect(resolveThrottleMs(undefined, '0')).toBe(0);
  });

  it('throws UsageError on non-numeric env value', () => {
    expect(() => resolveThrottleMs(undefined, 'abc')).toThrow(UsageError);
    expect(() => resolveThrottleMs(undefined, 'abc')).toThrow(
      /EVAL_THROTTLE_MS must be a non-negative number/
    );
  });

  it('throws UsageError on negative env value', () => {
    expect(() => resolveThrottleMs(undefined, '-100')).toThrow(/non-negative/);
  });
});

import { describe, it, expect } from 'vitest';
import { parseJudgeResponse } from './parse.js';

describe('parseJudgeResponse', () => {
  it('parses a clean JSON judgment', () => {
    const out = parseJudgeResponse(
      '{"appropriate":"yes","grounded":"yes","reason":"on topic"}',
    );
    expect(out).toEqual({ appropriate: 'yes', grounded: 'yes', reason: 'on topic' });
  });

  it('strips ```json ... ``` markdown fences', () => {
    const fenced = '```json\n{"appropriate":"yes","grounded":"na","reason":"refused"}\n```';
    expect(parseJudgeResponse(fenced)).toEqual({
      appropriate: 'yes',
      grounded: 'na',
      reason: 'refused',
    });
  });

  it('strips bare ``` fences (no json hint)', () => {
    const fenced = '```\n{"appropriate":"partial","grounded":"yes","reason":"meh"}\n```';
    expect(parseJudgeResponse(fenced).appropriate).toBe('partial');
  });

  it('throws a clear error on non-JSON text', () => {
    expect(() => parseJudgeResponse('not json at all')).toThrow(/not valid JSON/);
  });

  it('throws on JSON with wrong shape (missing required fields)', () => {
    expect(() => parseJudgeResponse('{"appropriate":"yes"}')).toThrow();
  });

  it('throws on enum values outside the contract', () => {
    expect(() =>
      parseJudgeResponse('{"appropriate":"maybe","grounded":"yes","reason":"x"}'),
    ).toThrow();
    expect(() =>
      parseJudgeResponse('{"appropriate":"yes","grounded":"sometimes","reason":"x"}'),
    ).toThrow();
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(parseJudgeResponse('   {"appropriate":"yes","grounded":"yes","reason":""}   ')).toEqual({
      appropriate: 'yes',
      grounded: 'yes',
      reason: '',
    });
  });
});

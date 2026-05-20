import { describe, it, expect } from 'vitest';
import { buildFilter } from './buildFilter.js';

describe('buildFilter — honored keys', () => {
  it('maps category and tags into the RunFilter', () => {
    const out = buildFilter({ category: 'positive', tags: 'core,smoke' }, undefined);
    expect(out).toEqual({ category: 'positive', tags: ['core', 'smoke'] });
  });

  it('includes limit when provided', () => {
    expect(buildFilter({}, 5)).toEqual({ limit: 5 });
  });
});

describe('buildFilter — unknown-key warning', () => {
  it('warns naming the unknown key', () => {
    const warnings: string[] = [];
    buildFilter({ categroy: 'positive' }, undefined, (m) => warnings.push(m));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('categroy');
    expect(warnings[0]).toMatch(/known: category, tags/);
  });

  it('lists every unknown key', () => {
    const warnings: string[] = [];
    buildFilter({ foo: 'a', bar: 'b' }, undefined, (m) => warnings.push(m));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('foo');
    expect(warnings[0]).toContain('bar');
  });

  it('does not warn for category', () => {
    const warnings: string[] = [];
    buildFilter({ category: 'positive' }, undefined, (m) => warnings.push(m));
    expect(warnings).toHaveLength(0);
  });

  it('does not warn for tags', () => {
    const warnings: string[] = [];
    buildFilter({ tags: 'core' }, undefined, (m) => warnings.push(m));
    expect(warnings).toHaveLength(0);
  });

  it('does not warn for category + tags together', () => {
    const warnings: string[] = [];
    buildFilter({ category: 'positive', tags: 'core' }, undefined, (m) => warnings.push(m));
    expect(warnings).toHaveLength(0);
  });

  it('still honors recognized keys even when an unknown key is present', () => {
    const out = buildFilter({ category: 'positive', categroy: 'oops' }, undefined, () => {});
    expect(out).toEqual({ category: 'positive' });
  });
});

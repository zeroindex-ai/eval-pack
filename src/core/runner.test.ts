import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runEval, type ItemEvent } from './runner.js';
import { mustMention, citationCount } from './checks.js';
import { markerCitationExtractor } from './citations.js';
import type {
  AnswerResult,
  GoldenItem,
  GoldenSet,
  Judge,
  Judgment,
  PartialResult,
  Subject,
} from './schema.js';

// ---- fixtures ------------------------------------------------------------

const golden: GoldenSet = {
  version: '1.0',
  items: [
    {
      id: 'services',
      category: 'positive',
      question: 'What services?',
      must_mention: ['audit'],
      tags: ['core'],
    },
    {
      id: 'pricing',
      category: 'positive',
      question: 'How much?',
      must_mention: ['fixed-fee'],
      tags: ['core'],
    },
    {
      id: 'pizza',
      category: 'negative',
      question: 'Best pizza?',
      expect_refusal: true,
      tags: ['off-topic'],
    },
  ],
};

const HAPPY_TEXT: Record<string, string> = {
  'What services?': 'We offer audit and build. [chunk:3]',
  'How much?': 'Engagements are fixed-fee. [chunk:21]',
  'Best pizza?': "I don't have information about pizza.",
};

const happySubject: Subject = async (question) => ({
  text: HAPPY_TEXT[question] ?? '',
  retrievedRefs: ['3', '21'],
});

const yesJudge: Judge = {
  name: 'fake-yes-judge',
  run: async () => ({ appropriate: 'yes', grounded: 'yes', reason: 'fine' }) as Judgment,
};

// ---- tests --------------------------------------------------------------

describe('runEval — basic flow', () => {
  it('runs every item, returns one Result per item, no errors', async () => {
    const report = await runEval({
      golden,
      subject: happySubject,
      checks: [mustMention()],
      citationExtractor: markerCitationExtractor(/\[chunk:(\d+)\]/g),
    });
    expect(report.results.map((r) => r.id)).toEqual(['services', 'pricing', 'pizza']);
    expect(report.errors).toEqual([]);
    expect(report.judgeName).toBeUndefined();
  });

  it('populates citationRefs from citationExtractor', async () => {
    const report = await runEval({
      golden,
      subject: happySubject,
      citationExtractor: markerCitationExtractor(/\[chunk:(\d+)\]/g),
    });
    const services = report.results.find((r) => r.id === 'services')!;
    expect(services.citationRefs).toEqual(['3']);
  });

  it('uses noop citation extractor by default', async () => {
    const report = await runEval({ golden, subject: happySubject });
    for (const r of report.results) expect(r.citationRefs).toEqual([]);
  });
});

describe('runEval — checks integration', () => {
  it('runs configured checks and includes results on each Result', async () => {
    const report = await runEval({
      golden,
      subject: happySubject,
      checks: [mustMention(), citationCount({ min: 1, skipWhen: (i) => i.expect_refusal === true })],
      citationExtractor: markerCitationExtractor(/\[chunk:(\d+)\]/g),
    });
    const services = report.results.find((r) => r.id === 'services')!;
    expect(services.checks.map((c) => c.name)).toEqual(['must_mention', 'citation_count']);
    expect(services.checks.every((c) => c.ok)).toBe(true);
  });

  it('default passRule: passes when all checks ok and no judge', async () => {
    const report = await runEval({
      golden,
      subject: happySubject,
      checks: [mustMention()],
      citationExtractor: markerCitationExtractor(/\[chunk:(\d+)\]/g),
    });
    expect(report.results.every((r) => r.pass)).toBe(true);
  });

  it('default passRule: fails when any check fails', async () => {
    const report = await runEval({
      golden,
      subject: async () => ({ text: 'unrelated' }),
      checks: [mustMention()],
      filter: { category: 'positive' }, // positives have must_mention terms
    });
    expect(report.results.length).toBeGreaterThan(0);
    expect(report.results.every((r) => r.pass === false)).toBe(true);
  });
});

describe('runEval — judge integration', () => {
  it('runs judge when configured and records judgeName', async () => {
    const report = await runEval({
      golden,
      subject: happySubject,
      checks: [mustMention()],
      citationExtractor: markerCitationExtractor(/\[chunk:(\d+)\]/g),
      judge: yesJudge,
    });
    expect(report.judgeName).toBe('fake-yes-judge');
    for (const r of report.results) {
      expect(r.judgment).toEqual({ appropriate: 'yes', grounded: 'yes', reason: 'fine' });
    }
  });

  it('judgment is null when no judge configured', async () => {
    const report = await runEval({ golden, subject: happySubject });
    for (const r of report.results) expect(r.judgment).toBeNull();
  });
});

describe('runEval — recall', () => {
  it('computes recall against relevant_refs when present', async () => {
    const g: GoldenSet = {
      version: '1.0',
      items: [
        {
          id: 'q1',
          category: 'positive',
          question: 'q',
          relevant_refs: ['a', 'b', 'c'],
        },
      ],
    };
    const subject: Subject = async () => ({
      text: '',
      retrievedRefs: ['a', 'b', 'x'],
    });
    const report = await runEval({ golden: g, subject });
    expect(report.results[0]!.recall).toBeCloseTo(2 / 3);
  });

  it('recall is null when relevant_refs absent', async () => {
    const report = await runEval({ golden, subject: happySubject });
    for (const r of report.results) expect(r.recall).toBeNull();
  });
});

describe('runEval — error isolation', () => {
  it('one failing item does not kill the run; error captured', async () => {
    const subject: Subject = async (q) => {
      if (q === 'How much?') throw new Error('boom');
      return { text: HAPPY_TEXT[q] ?? '', retrievedRefs: [] };
    };
    const report = await runEval({ golden, subject });
    expect(report.results.map((r) => r.id)).toEqual(['services', 'pizza']);
    expect(report.errors).toEqual([{ id: 'pricing', error: 'boom' }]);
  });

  it('non-Error throws are wrapped', async () => {
    const subject: Subject = async () => {
      throw 'string-thrown';
    };
    const report = await runEval({
      golden: { version: '1.0', items: [golden.items[0]!] },
      subject,
    });
    expect(report.errors[0]).toEqual({ id: 'services', error: 'string-thrown' });
  });
});

describe('runEval — filter', () => {
  it('filters by category', async () => {
    const report = await runEval({
      golden,
      subject: happySubject,
      filter: { category: 'negative' },
    });
    expect(report.results.map((r) => r.id)).toEqual(['pizza']);
  });

  it('filters by tags (any-match)', async () => {
    const report = await runEval({
      golden,
      subject: happySubject,
      filter: { tags: ['core'] },
    });
    expect(report.results.map((r) => r.id)).toEqual(['services', 'pricing']);
  });

  it('filters by limit', async () => {
    const report = await runEval({
      golden,
      subject: happySubject,
      filter: { limit: 2 },
    });
    expect(report.results.map((r) => r.id)).toEqual(['services', 'pricing']);
  });

  it('combines category + limit', async () => {
    const report = await runEval({
      golden,
      subject: happySubject,
      filter: { category: 'positive', limit: 1 },
    });
    expect(report.results.map((r) => r.id)).toEqual(['services']);
  });
});

describe('runEval — onItem hook', () => {
  it('fires start + pass/fail/error in order', async () => {
    const subject: Subject = async (q) => {
      if (q === 'How much?') throw new Error('boom');
      return { text: HAPPY_TEXT[q] ?? '', retrievedRefs: [] };
    };
    const events: ItemEvent[] = [];
    await runEval({
      golden,
      subject,
      checks: [mustMention(), citationCount({ min: 1 })], // citation check fails on the refusal
      citationExtractor: markerCitationExtractor(/\[chunk:(\d+)\]/g),
      onItem: (e) => events.push(e),
    });
    const types = events.map((e) => e.type);
    // 3 items: services (start, pass), pricing (start, error), pizza (start, fail — no citations)
    expect(types).toEqual(['start', 'pass', 'start', 'error', 'start', 'fail']);
  });
});

describe('runEval — JSON persistence', () => {
  it('writes run-<timestamp>.json when resultsDir is set', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eval-pack-'));
    try {
      const report = await runEval({
        golden,
        subject: happySubject,
        checks: [mustMention()],
        citationExtractor: markerCitationExtractor(/\[chunk:(\d+)\]/g),
        resultsDir: dir,
      });
      expect(report.jsonPath).toBeDefined();
      expect(report.jsonPath!.startsWith(dir)).toBe(true);
      const written = JSON.parse(await readFile(report.jsonPath!, 'utf-8'));
      expect(written.results).toHaveLength(3);
      expect(written.ran).toBe(report.ran);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not write when resultsDir is omitted', async () => {
    const report = await runEval({ golden, subject: happySubject });
    expect(report.jsonPath).toBeUndefined();
  });
});

describe('runEval — partial-result snapshot for checks', () => {
  it('checks see the assembled PartialResult', async () => {
    const seen: PartialResult[] = [];
    const customCheck = (_item: GoldenItem, r: PartialResult) => {
      seen.push(r);
      return { name: 'inspector', ok: true };
    };
    await runEval({
      golden: { version: '1.0', items: [golden.items[0]!] },
      subject: async () => ({ text: 'audit', retrievedRefs: ['1'] }) satisfies AnswerResult,
      checks: [customCheck],
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.text).toBe('audit');
    expect(seen[0]!.retrievedRefs).toEqual(['1']);
    expect(seen[0]!.timings.totalMs).toBeGreaterThanOrEqual(0);
  });
});

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  GoldenSetSchema,
  type Check,
  type CitationExtractor,
  type GoldenItem,
  type GoldenSet,
  type Judge,
  type PartialResult,
  type Result,
  type Subject,
} from './schema.js';
import { noopCitationExtractor } from './citations.js';
import { defaultPassRule, type PassRule } from './passRule.js';
import { recallAtK } from './metrics.js';

// ============================================================================
// runEval — the orchestration loop
// ============================================================================
// Loads a golden set, runs each item through the user-supplied subject,
// applies checks + (optionally) the judge, computes pass via passRule,
// aggregates a report. Per-item errors are isolated: one failing item
// doesn't kill the run.

export type RunFilter = {
  category?: string;
  tags?: string[];
  limit?: number;
};

export type ItemEvent =
  | { type: 'start'; index: number; total: number; item: GoldenItem }
  | { type: 'pass'; index: number; result: Result }
  | { type: 'fail'; index: number; result: Result }
  | { type: 'error'; index: number; item: GoldenItem; error: Error };

export type RunOptions = {
  /** Path to a golden-set JSON file OR a pre-loaded GoldenSet. */
  golden: string | GoldenSet;
  /** User's pipeline wrapped as a question → AnswerResult function. */
  subject: Subject;
  /** Programmatic checks applied after the subject runs. */
  checks?: Check[];
  /** Optional LLM judge. When absent, results have judgment=null. */
  judge?: Judge;
  /** How to pull citation refs from result.text. Default: noopCitationExtractor. */
  citationExtractor?: CitationExtractor;
  /** Pass/fail rule. Default: defaultPassRule. */
  passRule?: PassRule;
  /** Sleep this many ms between items (vendor rate-limit hedging). Default: 0. */
  throttleMs?: number;
  /** Filter items before running. */
  filter?: RunFilter;
  /** When set, persist the run as run-<ts>.json under this directory. */
  resultsDir?: string;
  /** Progress hook: fires once per item with start / pass / fail / error events. */
  onItem?: (event: ItemEvent) => void;
};

export type RunReport = {
  /** ISO timestamp the run completed. */
  ran: string;
  /** Judge identifier when one was used. */
  judgeName?: string;
  /** One entry per successfully-executed item. */
  results: Result[];
  /** One entry per item that threw inside the subject / checks / judge. */
  errors: Array<{ id: string; error: string }>;
  /** Path of the persisted JSON when resultsDir was set. */
  jsonPath?: string;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function loadGolden(source: string | GoldenSet): Promise<GoldenSet> {
  if (typeof source !== 'string') return source;
  const raw = await readFile(source, 'utf-8');
  return GoldenSetSchema.parse(JSON.parse(raw));
}

function applyFilter(items: GoldenItem[], filter: RunFilter | undefined): GoldenItem[] {
  if (filter === undefined) return items;
  let out = items;
  if (filter.category !== undefined) {
    out = out.filter((i) => i.category === filter.category);
  }
  if (filter.tags !== undefined && filter.tags.length > 0) {
    const want = new Set(filter.tags);
    out = out.filter((i) => i.tags?.some((t) => want.has(t)) ?? false);
  }
  if (filter.limit !== undefined) {
    out = out.slice(0, filter.limit);
  }
  return out;
}

async function runOne(
  item: GoldenItem,
  subject: Subject,
  citationExtractor: CitationExtractor,
  checks: Check[],
  judge: Judge | undefined,
  passRule: PassRule,
): Promise<Result> {
  const t0 = Date.now();
  const ans = await subject(item.question);
  const totalMs = Date.now() - t0;

  const retrievedRefs = ans.retrievedRefs ?? [];
  const citationRefs = citationExtractor(ans.text);
  const recall =
    item.relevant_refs && item.relevant_refs.length > 0
      ? recallAtK(retrievedRefs, item.relevant_refs)
      : null;

  const partial: PartialResult = {
    id: item.id,
    category: item.category,
    question: item.question,
    text: ans.text,
    retrievedRefs,
    citationRefs,
    recallAtK: recall,
    timings: { totalMs },
    metadata: ans.metadata ?? {},
  };

  const checkResults = checks.map((c) => c(item, partial));
  const judgment = judge ? await judge.run(item, partial) : null;

  const result: Result = {
    ...partial,
    checks: checkResults,
    judgment,
    pass: false,
  };
  result.pass = passRule(result);
  return result;
}

export async function runEval(options: RunOptions): Promise<RunReport> {
  const set = await loadGolden(options.golden);
  const items = applyFilter(set.items, options.filter);
  const throttle = options.throttleMs ?? 0;
  const citationExtractor = options.citationExtractor ?? noopCitationExtractor;
  const passRule = options.passRule ?? defaultPassRule;
  const checks = options.checks ?? [];
  const onItem = options.onItem ?? (() => {});

  const results: Result[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (const [i, item] of items.entries()) {
    if (i > 0 && throttle > 0) await sleep(throttle);
    onItem({ type: 'start', index: i, total: items.length, item });
    try {
      const r = await runOne(item, options.subject, citationExtractor, checks, options.judge, passRule);
      results.push(r);
      onItem({ type: r.pass ? 'pass' : 'fail', index: i, result: r });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push({ id: item.id, error: error.message });
      onItem({ type: 'error', index: i, item, error });
    }
  }

  const report: RunReport = {
    ran: new Date().toISOString(),
    results,
    errors,
  };
  if (options.judge) report.judgeName = options.judge.name;

  if (options.resultsDir !== undefined) {
    await mkdir(options.resultsDir, { recursive: true });
    const stamp = report.ran.replace(/[:.]/g, '-');
    const path = join(options.resultsDir, `run-${stamp}.json`);
    await writeFile(path, JSON.stringify(report, null, 2));
    report.jsonPath = path;
  }

  return report;
}

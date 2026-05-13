import type { Check, GoldenItem } from './schema.js';

// ============================================================================
// Built-in programmatic checks
// ============================================================================
// Each factory returns a `Check`: (item, partialResult) => CheckResult.
// Users compose these in their runEval() config and add custom checks
// alongside them.

// ----------------------------------------------------------------------------
// mustMention — every term in item.must_mention must appear in result.text
// ----------------------------------------------------------------------------

export type MustMentionOpts = {
  /** When true, terms must match case exactly. Default: false (case-insensitive). */
  caseSensitive?: boolean;
};

export function mustMention(opts: MustMentionOpts = {}): Check {
  return (item, result) => {
    const terms = item.must_mention ?? [];
    const haystack = opts.caseSensitive ? result.text : result.text.toLowerCase();
    const missing = terms.filter((t) => {
      const needle = opts.caseSensitive ? t : t.toLowerCase();
      return !haystack.includes(needle);
    });
    return {
      name: 'must_mention',
      ok: missing.length === 0,
      detail: missing.length > 0 ? { missing } : undefined,
    };
  };
}

// ----------------------------------------------------------------------------
// mustNotMention — no term in item.must_not_mention may appear in result.text
// ----------------------------------------------------------------------------

export type MustNotMentionOpts = {
  /** When true, terms must match case exactly. Default: false (case-insensitive). */
  caseSensitive?: boolean;
};

export function mustNotMention(opts: MustNotMentionOpts = {}): Check {
  return (item, result) => {
    const terms = item.must_not_mention ?? [];
    const haystack = opts.caseSensitive ? result.text : result.text.toLowerCase();
    const found = terms.filter((t) => {
      const needle = opts.caseSensitive ? t : t.toLowerCase();
      return haystack.includes(needle);
    });
    return {
      name: 'must_not_mention',
      ok: found.length === 0,
      detail: found.length > 0 ? { found } : undefined,
    };
  };
}

// ----------------------------------------------------------------------------
// citationCount — result.citationRefs.length must meet a minimum, with an
// optional escape hatch (skipWhen) for items where citations aren't expected
// (e.g. refusals).
// ----------------------------------------------------------------------------

export type CitationCountOpts = {
  /** Minimum number of citations required. */
  min: number;
  /** When this returns true for an item, the check is skipped (auto-passes). */
  skipWhen?: (item: GoldenItem) => boolean;
};

export function citationCount(opts: CitationCountOpts): Check {
  return (item, result) => {
    if (opts.skipWhen?.(item) === true) {
      return {
        name: 'citation_count',
        ok: true,
        detail: { skipped: true },
      };
    }
    const count = result.citationRefs.length;
    return {
      name: 'citation_count',
      ok: count >= opts.min,
      detail: { count, min: opts.min },
    };
  };
}

// ----------------------------------------------------------------------------
// expectRefusal — heuristic refusal detection against a configurable phrase
// list. Passes when item.expect_refusal === (actual refusal detected).
// Items without expect_refusal set are skipped (vacuously pass).
// ----------------------------------------------------------------------------

const DEFAULT_REFUSAL_PHRASES: readonly string[] = [
  "i don't have",
  "i don't know",
  "i can't help",
  "i can't answer",
  "i'm not able",
  "i'm unable",
  'i cannot help',
  'i cannot answer',
  "sorry, i can't",
  "sorry, i don't",
  "that's not something",
  'no information about',
  'not in the provided context',
  "isn't covered",
];

export type ExpectRefusalOpts = {
  /** Override the default refusal-phrase list. All matching is case-insensitive. */
  phrases?: readonly string[];
};

export function expectRefusal(opts: ExpectRefusalOpts = {}): Check {
  const phrases = opts.phrases ?? DEFAULT_REFUSAL_PHRASES;
  return (item, result) => {
    if (item.expect_refusal === undefined) {
      return {
        name: 'expect_refusal',
        ok: true,
        detail: { skipped: true },
      };
    }
    const lower = result.text.toLowerCase();
    const actual = phrases.some((p) => lower.includes(p.toLowerCase()));
    return {
      name: 'expect_refusal',
      ok: item.expect_refusal === actual,
      detail: { expected: item.expect_refusal, actual },
    };
  };
}

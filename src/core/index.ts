// Barrel for @zeroindex-ai/eval-pack core.

export { recall, percentile, p50, p95 } from './metrics.js';

export {
  GoldenItemSchema,
  GoldenSetSchema,
  JudgmentSchema,
  type AnswerResult,
  type Check,
  type CheckResult,
  type CitationExtractor,
  type GoldenItem,
  type GoldenSet,
  type Judge,
  type Judgment,
  type PartialResult,
  type Result,
  type Subject,
} from './schema.js';

export {
  mustMention,
  mustNotMention,
  citationCount,
  expectRefusal,
  type MustMentionOpts,
  type MustNotMentionOpts,
  type CitationCountOpts,
  type ExpectRefusalOpts,
} from './checks.js';

export { markerCitationExtractor, noopCitationExtractor } from './citations.js';

export { defaultPassRule, byCategory, type PassRule } from './passRule.js';

export { runEval, type ItemEvent, type RunFilter, type RunOptions, type RunReport } from './runner.js';

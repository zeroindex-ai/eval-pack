// Barrel for @zeroindex-ai/eval-pack core.
// Public API surface grows as work-list items 6–7 land
// (passRule, runner).

export { recallAtK, percentile, p50, p95 } from './metrics.js';

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

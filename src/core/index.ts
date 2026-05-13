// Barrel for @zeroindex-ai/eval-pack core.
// Public API surface grows as work-list items 4–7 land
// (checks, citations, passRule, runner).

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

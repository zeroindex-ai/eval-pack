import type { Result } from './schema.js';

// ============================================================================
// Pass rules
// ============================================================================
// A PassRule decides whether a fully-assembled Result counts as a pass.
// The default mirrors ask-zeroindex's current behavior. Users override by
// passing `passRule` to `runEval`.

export type PassRule = (result: Result) => boolean;

/**
 * Default pass rule: every check ok + (no judge configured, OR judge says
 * appropriate=yes and grounded ∈ {yes, na}).
 *
 * The `na` grounded value covers refusal items where citations aren't
 * expected — a clean refusal is a valid grounded answer.
 */
export const defaultPassRule: PassRule = (result) => {
  if (!result.checks.every((c) => c.ok)) return false;
  if (result.judgment === null) return true;
  if (result.judgment.appropriate !== 'yes') return false;
  if (result.judgment.grounded === 'no') return false;
  return true;
};

/**
 * Compose category-conditional rules. The map keys are category names;
 * the special key `default` is used when no category matches. If `default`
 * is omitted, `defaultPassRule` is used as the fallback.
 *
 * @example
 *   const rule = byCategory({
 *     positive: defaultPassRule,
 *     negative: (r) => r.checks.every(c => c.ok), // skip judge for negatives
 *     default:  defaultPassRule,
 *   });
 */
export function byCategory(map: Record<string, PassRule>): PassRule {
  const fallback = map['default'] ?? defaultPassRule;
  return (result) => (map[result.category] ?? fallback)(result);
}

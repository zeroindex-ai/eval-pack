import { JudgmentSchema, type Judgment } from '../core/schema.js';

/**
 * Parse a judge LLM response into a validated Judgment.
 *
 * Strips ```json / ``` markdown fences before parsing, then validates with
 * Zod. Throws a clear, debuggable error on either failure mode.
 */
export function parseJudgeResponse(text: string): Judgment {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Judge response was not valid JSON: ${cleaned.slice(0, 200)}`,
    );
  }

  return JudgmentSchema.parse(parsed);
}

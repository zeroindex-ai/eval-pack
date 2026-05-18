import Anthropic from '@anthropic-ai/sdk';
import type { Judge } from '../core/schema.js';
import { buildPrompt, DEFAULT_CATEGORY_GUIDANCE, DEFAULT_SYSTEM } from './prompt.js';
import { parseJudgeResponse } from './parse.js';

// Sonnet 4.6 is the eval-time judge. Consumers can override.
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 300;

export type ClaudeJudgeOpts = {
  /** Override the API key. Default: ANTHROPIC_API_KEY env var. */
  apiKey?: string;
  /** Model ID to judge with. Default: claude-sonnet-4-6. */
  model?: string;
  /** Max tokens for the judge's response. Default: 300. */
  maxTokens?: number;
  /** Override the system prompt entirely. */
  system?: string;
  /** Override the per-category guidance block of the user prompt. */
  categoryGuidance?: string;
  /** Inject a pre-built Anthropic client (testing / proxying). */
  client?: Anthropic;
};

/**
 * Build a Judge that calls Claude to evaluate answers. The returned object
 * satisfies the Judge contract from core/schema and can be passed to
 * runEval() as `judge`.
 */
export function claudeJudge(opts: ClaudeJudgeOpts = {}): Judge {
  const model = opts.model ?? DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const system = opts.system ?? DEFAULT_SYSTEM;
  const categoryGuidance = opts.categoryGuidance ?? DEFAULT_CATEGORY_GUIDANCE;
  const client = opts.client ?? new Anthropic(opts.apiKey !== undefined ? { apiKey: opts.apiKey } : {});

  return {
    name: `claude-judge(${model})`,
    run: async (item, result) => {
      const prompt = buildPrompt(item, result, categoryGuidance);
      const msg = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      });
      const block = msg.content[0];
      const text = block !== undefined && block.type === 'text' ? block.text : '';
      return parseJudgeResponse(text);
    },
  };
}

export { DEFAULT_SYSTEM, DEFAULT_CATEGORY_GUIDANCE, buildPrompt } from './prompt.js';
export { parseJudgeResponse } from './parse.js';

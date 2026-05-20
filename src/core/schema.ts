import { z } from 'zod';

// ============================================================================
// Trust-boundary schemas
// ============================================================================
// Only two surfaces need runtime validation: the golden-set JSON we load from
// disk, and the JSON we parse out of a judge's LLM response. Everything else
// is internal TypeScript and trusted.

export const GoldenItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  question: z.string(),
  relevant_refs: z.array(z.string()).optional(),
  must_mention: z.array(z.string()).optional(),
  must_not_mention: z.array(z.string()).optional(),
  expect_refusal: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type GoldenItem = z.infer<typeof GoldenItemSchema>;

export const GoldenSetSchema = z.object({
  version: z.literal('1.0'),
  items: z.array(GoldenItemSchema),
});

export type GoldenSet = z.infer<typeof GoldenSetSchema>;

export const JudgmentSchema = z.object({
  appropriate: z.enum(['yes', 'no', 'partial']),
  grounded: z.enum(['yes', 'no', 'na']),
  reason: z.string(),
});

export type Judgment = z.infer<typeof JudgmentSchema>;

// ============================================================================
// Internal contracts
// ============================================================================

// What a user-supplied subject returns. retrievedRefs is RAG-specific and
// optional; metadata is the escape hatch for anything else (tool calls,
// streaming timings, etc).
export type AnswerResult = {
  text: string;
  retrievedRefs?: string[];
  metadata?: Record<string, unknown>;
};

export type Subject = (question: string) => Promise<AnswerResult>;

// Pluggable citation extractor. ask-zeroindex uses `[chunk:N]` markers;
// other consumers may use `[doc:url]`, structured tool calls, or nothing.
export type CitationExtractor = (text: string) => string[];

export type CheckResult = {
  name: string;
  ok: boolean;
  detail?: Record<string, unknown>;
};

// What checks and the judge see when they run — everything the harness has
// assembled so far, minus the bits being computed (checks/judgment/pass).
export type PartialResult = {
  id: string;
  category: string;
  question: string;
  text: string;
  retrievedRefs: string[];
  citationRefs: string[];
  recall: number | null;
  timings: {
    retrievalMs?: number;
    firstTokenMs?: number;
    totalMs: number;
  };
  metadata: Record<string, unknown>;
};

export type Check = (item: GoldenItem, result: PartialResult) => CheckResult;

export type Judge = {
  name: string;
  run: (item: GoldenItem, result: PartialResult) => Promise<Judgment>;
};

export type Result = PartialResult & {
  checks: CheckResult[];
  judgment: Judgment | null;
  pass: boolean;
};

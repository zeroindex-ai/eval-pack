import { describe, it, expect, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { claudeJudge } from './index.js';
import type { GoldenItem, PartialResult } from '../core/schema.js';

// Build a fake Anthropic client whose messages.create returns a single
// text block with the supplied response string.
function fakeClient(responseText: string): Anthropic {
  return {
    messages: {
      create: vi.fn(async () => ({
        content: [{ type: 'text', text: responseText }],
      })),
    },
  } as unknown as Anthropic;
}

function captureClient(responseText: string): {
  client: Anthropic;
  calls: Array<{ model: string; max_tokens: number; system: string; messages: unknown }>;
} {
  const calls: Array<{
    model: string;
    max_tokens: number;
    system: string;
    messages: unknown;
  }> = [];
  const client = {
    messages: {
      create: async (params: {
        model: string;
        max_tokens: number;
        system: string;
        messages: unknown;
      }) => {
        calls.push(params);
        return { content: [{ type: 'text', text: responseText }] };
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

const item: GoldenItem = {
  id: 'q1',
  category: 'positive',
  question: 'What services?',
};

const result: PartialResult = {
  id: 'q1',
  category: 'positive',
  question: 'What services?',
  text: 'Audit and build.',
  retrievedRefs: [],
  citationRefs: ['1'],
  recallAtK: null,
  timings: { totalMs: 100 },
  metadata: {},
};

describe('claudeJudge factory', () => {
  it('returns a Judge that satisfies the contract', () => {
    const judge = claudeJudge({ client: fakeClient('') });
    expect(typeof judge.name).toBe('string');
    expect(typeof judge.run).toBe('function');
  });

  it('default judge.name embeds the default model id', () => {
    const judge = claudeJudge({ client: fakeClient('') });
    expect(judge.name).toContain('claude-sonnet-4-6');
  });

  it('respects a custom model in name and in the API call', async () => {
    const { client, calls } = captureClient(
      '{"appropriate":"yes","grounded":"yes","reason":"ok"}',
    );
    const judge = claudeJudge({ client, model: 'claude-haiku-4-5-20251001' });
    expect(judge.name).toContain('claude-haiku-4-5-20251001');
    await judge.run(item, result);
    expect(calls[0]!.model).toBe('claude-haiku-4-5-20251001');
  });

  it('passes the system prompt through to the API', async () => {
    const { client, calls } = captureClient(
      '{"appropriate":"yes","grounded":"yes","reason":"ok"}',
    );
    await claudeJudge({ client, system: 'CUSTOM SYSTEM' }).run(item, result);
    expect(calls[0]!.system).toBe('CUSTOM SYSTEM');
  });

  it('respects custom maxTokens', async () => {
    const { client, calls } = captureClient(
      '{"appropriate":"yes","grounded":"yes","reason":"ok"}',
    );
    await claudeJudge({ client, maxTokens: 50 }).run(item, result);
    expect(calls[0]!.max_tokens).toBe(50);
  });

  it('includes the category guidance in the user prompt', async () => {
    const { client, calls } = captureClient(
      '{"appropriate":"yes","grounded":"yes","reason":"ok"}',
    );
    await claudeJudge({
      client,
      categoryGuidance: 'GUIDE: be strict',
    }).run(item, result);
    const messages = calls[0]!.messages as Array<{ role: string; content: string }>;
    expect(messages[0]!.content).toContain('GUIDE: be strict');
  });

  it('returns a validated Judgment for a clean JSON response', async () => {
    const judge = claudeJudge({
      client: fakeClient('{"appropriate":"yes","grounded":"yes","reason":"on topic"}'),
    });
    const j = await judge.run(item, result);
    expect(j).toEqual({ appropriate: 'yes', grounded: 'yes', reason: 'on topic' });
  });

  it('propagates parse errors when the model returns malformed JSON', async () => {
    const judge = claudeJudge({ client: fakeClient('not json') });
    await expect(judge.run(item, result)).rejects.toThrow(/not valid JSON/);
  });

  it('handles empty content array by yielding empty text (then parse throws)', async () => {
    const broken = {
      messages: {
        create: async () => ({ content: [] }),
      },
    } as unknown as Anthropic;
    const judge = claudeJudge({ client: broken });
    await expect(judge.run(item, result)).rejects.toThrow();
  });
});

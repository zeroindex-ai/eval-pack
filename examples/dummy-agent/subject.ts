import type { Subject } from '../../src/core/schema.js';

// A toy lookup-based "FAQ bot." No LLM calls; pure deterministic mapping.
// Exists to demonstrate that eval-pack works for non-RAG subjects — anything
// shaped (question: string) => Promise<{ text, ... }> is fair game.

const FAQ: Record<string, string> = {
  'what is your name?': "I'm DummyBot.",
  'what is 2+2?': '2 + 2 = 4.',
  'what is your purpose?': "I'm a demonstration subject for the eval-pack examples — I answer a fixed FAQ.",
  'who created you?': 'I was scaffolded by @zeroindex-ai/eval-pack as a non-RAG example.',
};

const REFUSAL = "I don't know.";

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function detectInjection(q: string): boolean {
  const lower = q.toLowerCase();
  return (
    (lower.includes('ignore') && lower.includes('instruction')) ||
    lower.includes('system prompt') ||
    lower.includes('pretend you')
  );
}

export const subject: Subject = async (question) => {
  if (detectInjection(question)) {
    return { text: REFUSAL };
  }
  const text = FAQ[normalize(question)] ?? REFUSAL;
  return { text };
};

export default subject;

import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================================
// CLI integration — spawns the built `dist/cli/bin.js` against a dummy-agent
// shaped subject + golden in a tmpdir. Asserts exit code 0 (every item
// passes because there are no checks and `--judge none` leaves judgment
// null, so defaultPassRule passes everything) and that the per-item event
// stream lands on stdout. Skipped gracefully when dist/ doesn't exist.
// ============================================================================

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const BIN_PATH = join(REPO_ROOT, 'dist', 'cli', 'bin.js');

async function distBuilt(): Promise<boolean> {
  try {
    await stat(BIN_PATH);
    return true;
  } catch {
    return false;
  }
}

type SpawnResult = { code: number | null; stdout: string; stderr: string };

function runCli(args: readonly string[], cwd: string): Promise<SpawnResult> {
  return new Promise((resolveSpawn, rejectSpawn) => {
    const child = spawn(process.execPath, [BIN_PATH, ...args], {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });
    child.on('error', rejectSpawn);
    child.on('close', (code) => {
      resolveSpawn({ code, stdout, stderr });
    });
  });
}

// Mirrors examples/dummy-agent/subject.ts but emitted as JS so the test
// doesn't need tsx in-process. Same FAQ shape, same refusal behaviour.
const DUMMY_SUBJECT_JS = `
const FAQ = {
  'what is your name?': "I'm DummyBot.",
  'what is 2+2?': '2 + 2 = 4.',
};
const REFUSAL = "I don't know.";
function normalize(s) {
  return s.toLowerCase().trim().replace(/\\s+/g, ' ');
}
export const subject = async (question) => {
  const text = FAQ[normalize(question)] ?? REFUSAL;
  return { text };
};
`;

const DUMMY_GOLDEN = {
  version: '1.0',
  items: [
    {
      id: 'name',
      category: 'positive',
      question: 'What is your name?',
      must_mention: [],
      must_not_mention: [],
      expect_refusal: false,
    },
    {
      id: 'math',
      category: 'positive',
      question: 'What is 2+2?',
      must_mention: [],
      must_not_mention: [],
      expect_refusal: false,
    },
    {
      id: 'off-topic',
      category: 'negative',
      question: "What's the weather?",
      must_mention: [],
      must_not_mention: [],
      expect_refusal: true,
    },
  ],
};

describe('CLI integration — dist/cli/bin.js', () => {
  it('runs a dummy subject with --judge none and exits 0', async () => {
    if (!(await distBuilt())) {
      console.log(
        `[skip] dist/cli/bin.js not found at ${BIN_PATH}. Run \`pnpm build\` to enable the CLI integration test.`,
      );
      return;
    }

    const dir = await mkdtemp(join(tmpdir(), 'eval-pack-cli-'));
    try {
      const subjectPath = join(dir, 'subject.mjs');
      const goldenPath = join(dir, 'golden.json');
      await writeFile(subjectPath, DUMMY_SUBJECT_JS, 'utf-8');
      await writeFile(goldenPath, JSON.stringify(DUMMY_GOLDEN), 'utf-8');

      const { code, stdout, stderr } = await runCli(
        [
          'run',
          '--subject',
          subjectPath,
          '--golden',
          goldenPath,
          '--judge',
          'none',
        ],
        dir,
      );

      expect(code, `stderr was:\n${stderr}\nstdout was:\n${stdout}`).toBe(0);

      // Per-item pass events land on stdout (bin.ts onItem hook).
      expect(stdout).toContain('✓ name');
      expect(stdout).toContain('✓ math');
      expect(stdout).toContain('✓ off-topic');

      // Summary block from printSummary.
      expect(stdout).toContain('Pass rate by category');
      expect(stdout).toContain('TOTAL');
      expect(stdout).toContain('3/3');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('exits 2 on usage error (unknown flag)', async () => {
    if (!(await distBuilt())) {
      console.log(
        `[skip] dist/cli/bin.js not found at ${BIN_PATH}. Run \`pnpm build\` to enable the CLI integration test.`,
      );
      return;
    }

    const dir = await mkdtemp(join(tmpdir(), 'eval-pack-cli-'));
    try {
      const { code, stderr } = await runCli(
        ['run', '--not-a-real-flag', 'x'],
        dir,
      );
      expect(code).toBe(2);
      expect(stderr).toMatch(/Usage error|Unknown flag/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

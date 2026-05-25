import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { stat, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================================
// Published-tarball contents guard — runs `pnpm pack --json` and asserts the
// file list npm would publish matches the `files` whitelist in package.json.
//
// Catches two regression classes that would otherwise ship silently:
//   1. A stray file leaking into the tarball (src/, test files, *.tsbuildinfo,
//      .env*) because the whitelist drifted or someone added a top-level glob.
//   2. A missing/empty `dist/` — i.e. publishing without a build, which would
//      yield an unusable package that imports nothing.
//
// `pnpm pack` packs whatever is on disk (no implicit build), so dist/ must
// already exist. CI runs `pnpm build` before `pnpm test`, so by the time this
// test runs dist/ is present. When dist/ is absent (e.g. `pnpm test` locally
// without a build) the suite reports as SKIPPED via it.skipIf — visibly,
// rather than silently passing while asserting nothing.
// ============================================================================

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const DIST_DIR = join(REPO_ROOT, 'dist');

async function distBuilt(): Promise<boolean> {
  try {
    await stat(join(DIST_DIR, 'core', 'index.js'));
    return true;
  } catch {
    return false;
  }
}

// Resolved once at module load (top-level await) so it.skipIf can mark the
// suite skipped at collection time rather than no-op'ing inside the test body.
const DIST_BUILT = await distBuilt();

type PackJson = { filename: string; files: { path: string }[] };

async function packFileList(): Promise<{ files: string[]; tarball: string }> {
  const { stdout } = await runPack();
  // `pnpm pack --json` emits a JSON object (newer pnpm) describing the tarball.
  const parsed = JSON.parse(stdout) as PackJson | PackJson[];
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!entry) throw new Error(`pnpm pack --json returned no tarball entry:\n${stdout}`);
  const files = entry.files.map((f) => f.path.replace(/\\/g, '/'));
  // Clean up the tarball pnpm writes to the repo root.
  if (entry.filename) {
    await rm(join(REPO_ROOT, entry.filename), { force: true });
  }
  return { files, tarball: entry.filename };
}

type SpawnResult = { code: number | null; stdout: string; stderr: string };

function runPack(): Promise<SpawnResult> {
  return new Promise((resolveSpawn, rejectSpawn) => {
    const child = spawn('pnpm', ['pack', '--json'], {
      cwd: REPO_ROOT,
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
      if (code !== 0) {
        rejectSpawn(new Error(`pnpm pack exited ${code}\nstderr:\n${stderr}\nstdout:\n${stdout}`));
        return;
      }
      resolveSpawn({ code, stdout, stderr });
    });
  });
}

describe('published tarball contents', () => {
  it.skipIf(!DIST_BUILT)(
    'matches the package.json `files` whitelist',
    async () => {
      const { files } = await packFileList();

      // (a) dist/ is present and non-trivial (real build output, not an empty dir).
      const distFiles = files.filter((f) => f.startsWith('dist/'));
      expect(distFiles.length).toBeGreaterThan(0);
      expect(distFiles).toContain('dist/core/index.js');
      expect(distFiles).toContain('dist/cli/bin.js');

      // (b) no source, test, build-info, or env files leak into the tarball.
      const forbidden = files.filter(
        (f) =>
          f.startsWith('src/') ||
          /\.test\./.test(f) ||
          /\.spec\./.test(f) ||
          f.endsWith('.tsbuildinfo') ||
          /(^|\/)\.env($|\.)/.test(f)
      );
      expect(forbidden, `unexpected files in tarball: ${forbidden.join(', ')}`).toEqual([]);

      // (c) README and LICENSE are included (npm normalizes these to the root).
      expect(files).toContain('README.md');
      expect(files).toContain('LICENSE');

      // Every file must sit under the whitelist roots — no surprise top-level files.
      const allowedRoots = ['dist/', 'README.md', 'LICENSE', 'package.json'];
      const stray = files.filter((f) => !allowedRoots.some((r) => f === r || f.startsWith(r)));
      expect(stray, `files outside the whitelist: ${stray.join(', ')}`).toEqual([]);
    },
    // pnpm pack spawns a child process and walks the tree; give it headroom.
    30_000
  );
});

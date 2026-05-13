// Run with: pnpm tsx examples/dummy-agent/run.ts
//
// This example uses RELATIVE imports against src/ so it's runnable in-repo
// without an install step. As a real consumer of the published package the
// import would be:
//
//   import { runEval, mustMention, mustNotMention, expectRefusal } from '@zeroindex-ai/eval-pack';

import { join } from 'node:path';
import {
  runEval,
  mustMention,
  mustNotMention,
  expectRefusal,
} from '../../src/core/index.js';
import { subject } from './subject.js';

async function main(): Promise<void> {
  const goldenPath = join(import.meta.dirname, 'golden.json');

  const report = await runEval({
    golden: goldenPath,
    subject,
    checks: [mustMention(), mustNotMention(), expectRefusal()],
    // no judge — pure programmatic. This whole example runs offline + free.
  });

  const passed = report.results.filter((r) => r.pass).length;
  const total = report.results.length;
  console.log(`\n${passed}/${total} passed (${Math.round((passed / total) * 100)}%)`);

  for (const r of report.results) {
    const tag = r.pass ? '✓' : '✗';
    console.log(`  ${tag} ${r.id}: ${r.question}`);
    if (!r.pass) {
      for (const c of r.checks.filter((c) => !c.ok)) {
        console.log(`      - ${c.name} failed: ${JSON.stringify(c.detail)}`);
      }
    }
  }

  if (report.errors.length > 0) {
    console.log(`\nErrors (${report.errors.length}):`);
    for (const e of report.errors) console.log(`  [${e.id}] ${e.error}`);
  }

  if (passed !== total) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

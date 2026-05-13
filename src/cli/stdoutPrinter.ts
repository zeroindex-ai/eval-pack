import type { RunReport } from '../core/runner.js';

function pad(s: string | number, n: number): string {
  const str = String(s);
  return str + ' '.repeat(Math.max(0, n - str.length));
}

/**
 * Print a category-grouped pass-rate table + failures dump + saved-paths.
 * No colors (terminals vary); structure conveys severity.
 */
export function printSummary(report: RunReport, threshold: number | undefined): void {
  const total = report.results.length;
  const passed = report.results.filter((r) => r.pass).length;
  const passPct = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

  console.log('\n=== Pass rate by category ===\n');
  console.log(pad('category', 20) + 'pass rate');
  console.log('-'.repeat(45));

  const byCategory = new Map<string, { passed: number; total: number }>();
  for (const r of report.results) {
    const entry = byCategory.get(r.category) ?? { passed: 0, total: 0 };
    entry.total += 1;
    if (r.pass) entry.passed += 1;
    byCategory.set(r.category, entry);
  }
  for (const [cat, e] of byCategory) {
    const pct = Math.round((e.passed / e.total) * 100);
    console.log(pad(cat, 20) + `${e.passed}/${e.total} (${pct}%)`);
  }
  console.log('-'.repeat(45));
  console.log(pad('TOTAL', 20) + `${passed}/${total} (${passPct}%)`);
  if (threshold !== undefined) {
    console.log(`Threshold: ${(threshold * 100).toFixed(0)}%`);
  }

  if (report.errors.length > 0) {
    console.log(`\n=== Errors (${report.errors.length}) ===\n`);
    for (const e of report.errors) console.log(`  [${e.id}] ${e.error}`);
  }

  const failures = report.results.filter((r) => !r.pass);
  if (failures.length > 0) {
    console.log(`\n=== Failures (${failures.length}) ===\n`);
    for (const r of failures) {
      console.log(`[${r.id}] ${r.category} — "${r.question}"`);
      const failedChecks = r.checks.filter((c) => !c.ok);
      for (const c of failedChecks) {
        const detail = c.detail !== undefined ? ` ${JSON.stringify(c.detail)}` : '';
        console.log(`  - check ${c.name} failed${detail}`);
      }
      if (r.judgment !== null && r.judgment.appropriate !== 'yes') {
        console.log(`  - judge appropriate=${r.judgment.appropriate}: ${r.judgment.reason}`);
      }
      if (r.judgment !== null && r.judgment.grounded === 'no') {
        console.log(`  - judge grounded=no`);
      }
    }
  }

  if (report.jsonPath !== undefined) console.log(`\nSaved: ${report.jsonPath}`);
}

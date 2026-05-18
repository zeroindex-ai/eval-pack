import type { CheckResult, Result } from '../core/schema.js';

// ============================================================================
// HTML rendering helpers
// ============================================================================
// Pure string assembly; no DOM, no client JS. Each function returns an
// HTML fragment. The renderer is responsible for escaping every value that
// originates from the eval — answer text, judge reasons, item ids, etc.

export function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function checkTag(c: CheckResult): string {
  if (c.detail && (c.detail as { skipped?: boolean }).skipped === true) {
    return `<span class="tag skip">${escape(c.name)}: skipped</span>`;
  }
  const cls = c.ok ? 'ok' : 'fail';
  return `<span class="tag ${cls}">${escape(c.name)}: ${c.ok ? 'ok' : 'fail'}</span>`;
}

function checkDetail(c: CheckResult): string {
  if (c.detail === undefined) return '';
  return `<code>${escape(JSON.stringify(c.detail))}</code>`;
}

function renderChecks(checks: CheckResult[]): string {
  if (checks.length === 0) return '<em>no checks configured</em>';
  return checks.map((c) => `<div>${checkTag(c)} ${checkDetail(c)}</div>`).join('\n');
}

function renderResultBody(r: Result): string {
  const judgment = r.judgment
    ? `
      <div class="field">
        <span class="field-label">Judge:</span>
        <span class="tag ${r.judgment.appropriate === 'yes' ? 'ok' : 'fail'}">appropriate: ${escape(r.judgment.appropriate)}</span>
        <span class="tag ${r.judgment.grounded === 'no' ? 'fail' : 'ok'}">grounded: ${escape(r.judgment.grounded)}</span>
      </div>
      <div class="field">
        <span class="field-label">Judge reason:</span>
        ${escape(r.judgment.reason)}
      </div>`
    : '<div class="field"><span class="field-label">Judge:</span> <span class="tag muted">none</span></div>';

  const recall =
    r.recallAtK !== null
      ? `<div class="field"><span class="field-label">Recall@K:</span> <code>${(r.recallAtK * 100).toFixed(1)}%</code></div>`
      : '';

  const retrieved =
    r.retrievedRefs.length > 0
      ? `<div class="field"><span class="field-label">Retrieved refs:</span> <code>${escape(JSON.stringify(r.retrievedRefs))}</code></div>`
      : '';

  const citations =
    r.citationRefs.length > 0
      ? `<div class="field"><span class="field-label">Cited refs:</span> <code>${escape(JSON.stringify(r.citationRefs))}</code></div>`
      : '';

  return `
    <div class="body">
      <div class="field"><span class="field-label">Question:</span> ${escape(r.question)}</div>
      <div class="field"><span class="field-label">Category:</span> <code>${escape(r.category)}</code></div>
      ${retrieved}
      ${citations}
      ${recall}
      <div class="field"><span class="field-label">Total ms:</span> <code>${r.timings.totalMs}</code></div>
      <div class="field"><span class="field-label">Checks:</span><div style="margin-top:6px">${renderChecks(r.checks)}</div></div>
      ${judgment}
      <div class="field"><span class="field-label">Answer text:</span></div>
      <div class="text">${escape(r.text)}</div>
    </div>`;
}

export function renderFailureCard(r: Result): string {
  return `
    <details open>
      <summary class="fail">✗ <code>${escape(r.id)}</code> · ${escape(r.category)} · ${escape(r.question)}</summary>
      ${renderResultBody(r)}
    </details>`;
}

export function renderPassRow(r: Result): string {
  return `<tr>
    <td><code>${escape(r.id)}</code></td>
    <td>${escape(r.category)}</td>
    <td>${escape(r.question)}</td>
    <td class="num">${r.timings.totalMs}ms</td>
  </tr>`;
}

export function renderCategoryTable(results: Result[]): string {
  const byCategory = new Map<string, { total: number; passed: number; totalMs: number[] }>();
  for (const r of results) {
    const entry = byCategory.get(r.category) ?? { total: 0, passed: 0, totalMs: [] };
    entry.total += 1;
    if (r.pass) entry.passed += 1;
    entry.totalMs.push(r.timings.totalMs);
    byCategory.set(r.category, entry);
  }
  const rows = Array.from(byCategory.entries())
    .map(([cat, entry]) => {
      const pct = entry.total > 0 ? Math.round((entry.passed / entry.total) * 100) : 0;
      return `<tr>
        <td><code>${escape(cat)}</code></td>
        <td class="num">${entry.passed}/${entry.total}</td>
        <td class="num">${pct}%</td>
      </tr>`;
    })
    .join('\n');
  return `<table>
    <thead><tr><th>Category</th><th>Passed</th><th>Pass rate</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

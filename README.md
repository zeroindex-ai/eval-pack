# @zeroindex-ai/eval-pack

> Opinionated, dependency-light eval harness for RAG and agent applications built on Claude. By [ZeroIndex LLC](https://zeroindex.ai).

[![npm version](https://img.shields.io/npm/v/@zeroindex-ai/eval-pack.svg)](https://www.npmjs.com/package/@zeroindex-ai/eval-pack)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Status: v0.2.0.** API may change with feedback. See [PROJECT.md](./PROJECT.md) for design, decisions, and the ordered work list.

## What this is

eval-pack is the generalization of the LLM-as-judge + programmatic-checks pipeline that runs inside [`ask-zeroindex`](https://github.com/zeroindex-ai/ask-zeroindex). It gives you three things you'd otherwise build yourself for every AI app:

1. A **golden-set runner** with throttle handling, per-item error isolation, and threshold gating
2. A **judge** abstraction (Claude-backed in v0.1) plus built-in **programmatic checks** (`mustMention`, `mustNotMention`, `citationCount`, `expectRefusal`)
3. A **standalone HTML report renderer** that produces one self-contained file per run — suitable for CI artifacts, browser-local viewing, or iframe embedding

What it deliberately is not: a heavyweight platform. No service to host, no proprietary file format, no SaaS subscription. One package, subpath exports, a small CLI, and a companion GitHub composite action.

## Install

```bash
# minimal — no judge
pnpm add -D @zeroindex-ai/eval-pack

# with Claude judge (default)
pnpm add -D @zeroindex-ai/eval-pack @anthropic-ai/sdk
```

Requires Node 20+. As of v0.2.0, `@anthropic-ai/sdk` is an optional `peerDependency`. Install it alongside `eval-pack` if you use the Claude judge; omit it if you only run `--judge none` (programmatic checks only).

## Quick start

```ts
// evals/eval.ts
import { runEval, mustMention, citationCount, markerCitationExtractor } from '@zeroindex-ai/eval-pack';
import { claudeJudge } from '@zeroindex-ai/eval-pack/judge-claude';

// 1. Wrap your pipeline as a `subject` function.
const subject = async (question: string) => {
  const chunks = await yourRetriever(question);
  const text = await yourLLM(question, chunks);
  return { text, retrievedRefs: chunks.map((c) => String(c.id)) };
};

// 2. Configure checks + judge + run.
const report = await runEval({
  golden: 'evals/golden.json',
  subject,
  citationExtractor: markerCitationExtractor(/\[chunk:(\d+)\]/g),
  checks: [mustMention(), citationCount({ min: 1, skipWhen: (item) => item.expect_refusal === true })],
  judge: claudeJudge({ model: 'claude-sonnet-4-6' }),
  resultsDir: 'evals/results',
});

const passed = report.results.filter((r) => r.pass).length;
console.log(`${passed}/${report.results.length} passed`);
```

Or run from the CLI against a JS subject file:

```bash
pnpm eval-pack run \
  --subject ./evals/subject.js \
  --golden ./evals/golden.json \
  --threshold 0.8 \
  --html-out ./evals/results/latest.html
```

## Golden-set format

A golden set is a JSON file with a `version` wrapper and an array of items:

```json
{
  "version": "1.0",
  "items": [
    {
      "id": "services-list",
      "category": "positive",
      "question": "What services do you offer?",
      "relevant_refs": ["3", "4", "5"],
      "must_mention": ["audit", "build"],
      "must_not_mention": [],
      "expect_refusal": false,
      "tags": ["services"]
    }
  ]
}
```

Only `id`, `category`, and `question` are required. `category` is free-form — pick the axes that matter for your app (`positive`, `negative`, `adversarial`, etc.).

## Package exports

| Subpath                                | What                  | Key exports                                                                                      |
| -------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| `@zeroindex-ai/eval-pack`              | Core                  | `runEval`, types, built-in checks, citation extractors, `defaultPassRule`, `byCategory`, metrics |
| `@zeroindex-ai/eval-pack/checks`       | Convenience re-export | The four built-in checks                                                                         |
| `@zeroindex-ai/eval-pack/judge-claude` | Claude judge          | `claudeJudge()` factory, default prompt builders                                                 |
| `@zeroindex-ai/eval-pack/report-html`  | Report renderer       | `renderHtml(report, opts)`                                                                       |
| `eval-pack` (CLI binary)               | Command-line entry    | `eval-pack run [options]`                                                                        |

## Built-in checks

| Check                               | What it asserts                                                                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `mustMention(opts?)`                | Every term in `item.must_mention` appears in the answer (case-insensitive by default; set `caseSensitive: true` for exact)                   |
| `mustNotMention(opts?)`             | No term in `item.must_not_mention` appears                                                                                                   |
| `citationCount({ min, skipWhen? })` | `result.citationRefs.length >= min`, with optional auto-skip for refusal items                                                               |
| `expectRefusal({ phrases? })`       | Heuristic refusal detection. Passes when `item.expect_refusal === (actual refusal detected)`. Auto-skips items without `expect_refusal` set. Coarse, English-only case-insensitive substring match — can false-positive (e.g. "I don't know why…") and miss non-English refusals; override `phrases` to adjust. |

Custom checks are functions with the shape `(item: GoldenItem, partial: PartialResult) => CheckResult`. No DSL, no plugin registration — just write a function and pass it.

## CLI

```
eval-pack run [options]

Options:
  --golden <path>          Path to golden JSON (default: evals/golden.json)
  --subject <path>         JS file exporting a 'subject' function (required)
  --judge <name>           "claude" or "none" (default: claude)
  --judge-model <id>       Override judge model (default: claude-sonnet-4-6)
  --threshold <ratio>      Pass-rate threshold 0–1
  --filter <key=value>     Filter golden items. Keys are independent
                           (category, tags) — one value per key; repeating
                           the SAME key overwrites the earlier value.
                           Tags accepts a comma-separated list — items match
                           if they have ANY of the listed tags.
                           e.g. --filter tags=smoke,core
  --limit <n>              Max items to run
  --throttle-ms <n>        Sleep between items (vendor rate-limit hedging)
  --results-dir <path>     Where to write run JSON (default: evals/results)
  --html-out <path>        Write HTML report to this path
  --quiet                  Suppress per-item stdout
  --help, -h               Show this help
```

Exit codes: `0` pass, `1` below threshold, `2` usage error, `3` every item errored.

`--threshold` and `--throttle-ms` fall back to `EVAL_PASS_THRESHOLD` and `EVAL_THROTTLE_MS` env vars when not set on the CLI.

TypeScript subject files require running the CLI under `tsx`. The published `bin` has a `node` shebang, so point `tsx` at the bin script directly: `pnpm exec tsx node_modules/.bin/eval-pack run ...` (this is exactly what the GitHub composite action does). Or pre-compile your subject to JS. Bundling `tsx` is a v0.2 candidate.

## GitHub composite action

Drop one `uses:` into your workflow instead of stitching pnpm + Node + the CLI invocation yourself:

```yaml
# .github/workflows/eval.yml
name: Eval
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 14 * * *'
  workflow_dispatch:

jobs:
  eval:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: zeroindex-ai/eval-pack/action@v1
        with:
          golden: evals/golden.json
          subject: ./evals/subject.ts
          threshold: '0.8'
          html-out: evals/results/latest.html
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          # plus whatever env your subject's pipeline needs
```

The action sets up pnpm + Node, runs `pnpm install --frozen-lockfile`, invokes the CLI via `tsx` (so TS subjects work), and uploads the JSON + HTML report as workflow artifacts (always — even on failure). Inputs mirror the CLI flags; `tsx` and `@zeroindex-ai/eval-pack` must be devDependencies in your `package.json`.

Full action reference: [`action/action.yml`](./action/action.yml).

## HTML report

`renderHtml(report, opts)` returns a single self-contained HTML string — no client JS, no external assets. Safe to view via `file://`, embed via iframe, or ship as a CI artifact.

```ts
import { renderHtml } from '@zeroindex-ai/eval-pack/report-html';
import { writeFileSync } from 'node:fs';

const html = renderHtml(report, {
  projectName: 'my-rag-app',
  threshold: 0.8,
});
writeFileSync('eval-report.html', html);
```

The report shows: headline pass-rate (vs threshold if provided), per-category table, expanded failure cards (question, retrieved refs, cited refs, recall, all checks, judge appropriate/grounded/reason, full answer text), a collapsed pass list, and an errors table when items threw.

## Develop

```bash
git clone https://github.com/zeroindex-ai/eval-pack
cd eval-pack
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

CI runs the same gates across Node 20, 22, and 24 on every PR and push to `main`.

## Status & roadmap

- ✅ **v0.1** — core, Claude judge, HTML report, CLI
- ✅ **v0.1.x** — `ask-zeroindex` reference port, GitHub composite action, dummy-agent example, `evals.zeroindex.ai` published reports
- ✅ **v0.2.0** — `@anthropic-ai/sdk` moved to optional `peerDependency`; tag-driven `release.yml` workflow with npm provenance
- 🔭 **v0.2 candidates** — OpenAI / Gemini judges (adapter pattern), agent-specific primitives (tool-call assertions, trajectory grading), run-over-run diffing + regression detection

Full design + decision log + ordered work list: **[PROJECT.md](./PROJECT.md)**.

## License

MIT — see [LICENSE](./LICENSE).

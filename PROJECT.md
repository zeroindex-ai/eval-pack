# eval-pack — Project Documentation

> Last updated: 2026-05-12 (pre-implementation)
> Author: Abhishek Bhandari, with iterative collaboration via Claude Code
>
> **Status: Plan only.** Repo not scaffolded yet. This file captures the full design before any code lands so the first commit can be mechanical.

This document captures the scope, strategic decisions, architecture, public API contracts, distribution shape, and ordered work list for `eval-pack`. It exists to:

1. Onboard future collaborators (or future-you, in a clean session)
2. Capture the **reasoning** behind decisions, not just the decisions themselves
3. Document the engineering decisions and tradeoffs as a durable complement to the code
4. Be the source of truth that the first commit (scaffold + lifted `metrics.ts`) is validated against

---

## 1. Project overview

### What `eval-pack` is

An opinionated open-source eval harness for RAG and agent applications built on Claude. It is the generalization of the LLM-as-judge + programmatic-checks pipeline currently inlined inside `ask-zeroindex/evals/`. Distributed as a single npm package (`@zeroindex-ai/eval-pack`) with subpath exports and a companion GitHub composite action (`zeroindex-ai/eval-pack/action@v1`).

The package gives an AI-application author three things they'd otherwise build themselves:

1. A **golden-set runner** with throttle handling, error isolation per item, and threshold gating
2. A **judge** abstraction (Claude-backed in v0.1) and a small set of **built-in programmatic checks** (`mustMention`, `mustNotMention`, `citationCount`, `expectRefusal`)
3. A **standalone HTML report renderer** that produces one self-contained file per run — suitable for CI artifacts, browser-local viewing, or iframe embedding

### Why this project

The eval methodology that powers `ask-zeroindex` (LLM-as-judge + programmatic checks + threshold-gated CI) is the kind of thing every Claude-based application needs but few teams have packaged in a small, opinionated, dependency-light way. The discipline already runs inside `ask-zeroindex/evals/`; extracting it as a public npm package makes it usable everywhere else.

- **Lifted from production, not greenfield.** The core logic already exists and is battle-tested inside `ask-zeroindex/evals/`. The work here is generalization, packaging, and distribution discipline.
- **Reusable across any Claude app.** Anything shaped `(question) => Promise<AnswerResult>` is a valid subject — RAG pipelines, agents, plain chat. The harness never imports the caller's stack.
- **Small surface, no platform.** One package, subpath exports, a CLI, a composite action. No service to host, no proprietary format, no lock-in.

### Goals & success criteria for v0.1

| Goal | Metric | Status |
|---|---|---|
| `ask-zeroindex` consumes `eval-pack` instead of inlined harness | The 30-query seed run reproduces the documented 90% pass rate from `eval-baselines.md` | ✅ |
| Second consumer proves the contract isn't RAG-shaped | `examples/dummy-agent` runs eval-pack against a non-RAG subject with a tiny golden set | ✅ |
| Public HTML report | `evals.zeroindex.ai/ask-zeroindex/latest` live | ✅ |
| Reusable GitHub composite action | Consumer workflow drops from ~35 lines to ~10 | ✅ |
| Published to npm | `@zeroindex-ai/eval-pack` v0.1.0 public on npmjs.com | ✅ |

### Out of scope (for v0.1)

- OpenAI / Gemini judges. Single-provider keeps the contract honest until a second provider exercises the adapter point.
- Agent-specific primitives (tool-call assertions, trajectory grading, ReAct trace inspection). Land in v0.2 once `repo-xray` exposes the shape.
- Live web dashboard or queryable run history. A separate dashboard tool can ingest the JSON output; `eval-pack` stays a file-producing library.
- Dataset versioning, run-over-run diffing, regression detection. v0.2.
- Streaming first-token latency in the core API. Subject returns final text; if a user wants streaming latency captured, they put it in `result.metadata` from inside their subject.
- Redaction layer for the HTML report. Optional hook stub in v0.1; full implementation when a consumer needs it.
- Telemetry / phone-home / usage analytics. Never.

---

## 2. Strategic decisions log

Load-bearing decisions, documented because the *why* often outlasts the *what*.

### Stack picks

| Decision | Choice | Reasoning |
|---|---|---|
| **Repo layout** | Single-package monorepo at `github.com/zeroindex-ai/eval-pack` | The pieces (core, judge, report, cli) are always installed together by the same user for the same project. The dep-graph split that justifies `mcp-pack`'s 4 separate packages does not exist here. Single package with subpath exports gives the same import ergonomics and clean module boundaries without 5 `package.json` files and 5 release pipelines. |
| **Language** | TypeScript, ESM-only | Consistent with `mcp-pack` and `ask-zeroindex`. |
| **Validation** | Zod 4 | Already in the stack. Needed at golden-set load + judge-output parse boundaries. |
| **Tests** | Vitest | Already in `mcp-pack` and `ask-zeroindex`. |
| **Bundling** | `tsc` per build, output to `dist/` | Same as `mcp-pack`. No bundler complexity for a Node-only library. |
| **LLM SDK in judge** | Direct `@anthropic-ai/sdk` for v0.1 | Avoids adding an AI SDK runtime dependency for a one-provider start. v0.2 introduces an adapter when adding OpenAI. |
| **CLI framework** | No framework — manual `process.argv` parsing + small `--flag` helper | Following `ask-zeroindex`'s lean script convention. `commander` / `yargs` are overkill at ≤8 flags. |
| **Report renderer** | Single-file static HTML, no client JS | One self-contained artifact per run. Works as a GitHub Actions artifact, opens in any browser, embeds via iframe. Zero hosting requirement. |
| **Package manager** | pnpm 10 | Same as `mcp-pack` and `ask-zeroindex`. |
| **Node** | 24 LTS | Same as the rest of the rotation. |
| **License** | MIT | Matches `mcp-pack`. Apache-2.0's patent grant matters when companies *contribute* upstream; for a tool they *consume*, MIT is what every enterprise legal team has already pre-cleared. |

### Things deliberately NOT chosen

| Avoided | Why |
|---|---|
| Five-package split (`eval-core`, `eval-judge-claude`, `eval-report-html`, `eval-cli`, `eval-action`) | Initial draft favored this for mcp-pack consistency. Rejected on second pass: nobody installs `eval-core` alone, the dep graph is artificial, and the release/version coordination overhead is real. The mcp-pack split is honest because each server wraps a different vendor with different consumers. This case isn't symmetric. |
| `commander` / `yargs` / `clipanion` for the CLI | <8 flags. Hand-rolled parsing is ~30 lines and zero deps. |
| LangChain / LangSmith / Braintrust / promptfoo style heavy framework | Each is a fine product. None match the philosophy: this is a small library used as a building block, not a platform. |
| AI SDK adapter in v0.1 | Real adapter design needs a second provider implementation to validate against. Premature otherwise. |
| OpenAI / Gemini judges in v0.1 | See above. |
| Built-in regression-detection / run diffing | Useful, but introduces history storage opinion. Deferred to v0.2. |
| Multi-turn conversation evals | Single-turn covers the current consumer (`ask-zeroindex`) and the next three. Multi-turn lands when `intake-zero` needs it. |

### Architecture decisions

| Decision | Choice | Reasoning |
|---|---|---|
| **User-supplied subject function** | `Subject = (question: string) => Promise<AnswerResult>` | The library never imports a user's stack. The user wraps their own pipeline in a closure; the harness orchestrates. Keeps `eval-pack` zero-knowledge about retrieval, models, vector stores. |
| **Pluggable citation extractor** | `CitationExtractor = (text: string) => string[]` | `ask-zeroindex` uses `[chunk:N]` markers; other projects use `[doc:url]`, structured tool calls, or no citations at all. Ship `markerCitationExtractor(regex)` + `noopCitationExtractor`. |
| **Composable check pipeline** | Each check is `(item, result) => CheckResult` | The 4 built-ins cover the current consumer. Users add custom checks by writing functions. No DSL, no config file. |
| **Pass rule overridable** | Default rule matches `ask-zeroindex`'s current logic; users pass `passRule: (Result) => boolean` to override | Avoids hardcoding the `programmatic && judge.appropriate==='yes'` shape. |
| **Pluggable judge interface** | `Judge = { name, run: (item, result) => Promise<Judgment> }` | The judge is an LLM call; doesn't belong baked into `runEval`. Ship `claudeJudge({model})`; future `openaiJudge()` slots into the same interface. |
| **Throttle handling at the runner** | `throttleMs` config, sleep between items | Voyage free tier (3 RPM) was the actual constraint on `ask-zeroindex`'s eval; rather than make every subject re-invent throttling, do it once at the orchestrator. |
| **Per-item error tolerance** | If a single item throws, log and continue; aggregate pass-rate uses only successful items; runner exits non-zero if zero items succeeded | Matches `ask-zeroindex/evals/run.ts` behavior. A flaky network call shouldn't kill the run. |
| **Threshold gating in CLI, not core** | `runEval()` returns results; CLI checks threshold and sets exit code | Library users may want to do their own thresholding (e.g., per-category). Keeps the core API a pure function. |
| **Results JSON shape** | `{ model, ran, results: Result[] }` — matches existing `ask-zeroindex` format | Backwards-compatible with existing baseline files; no migration needed for historical comparison. |

### Resolved open questions (picks committed 2026-05-12)

These were called out in the plan as needing user input; resolutions captured here so the reasoning is durable.

| Question | Pick | Reasoning |
|---|---|---|
| Single package vs 5-package monorepo | **Single package with subpath exports** | The 5-package split is artificial for this product (see "Things deliberately NOT chosen"). Subpath exports give the same import clarity. |
| `evals.zeroindex.ai` infra | **Cloudflare Workers Static Assets**, same pattern as `zeroindex.ai` | New public repo `zeroindex-ai/evals-site` with auto-deploy. CI commits the HTML artifact; the static site serves it. Zero new infra to learn. R2 + signed URLs is the right answer at 10× scale and is not needed yet. |
| Full answer text in HTML report? | **Yes, full** | v0.1's only public consumer (`ask-zeroindex`) answers questions about ZeroIndex itself — nothing sensitive. Optional `redact?: (item, result) => Result` hook on the renderer keeps the door open; ship empty. |
| Schema migration in `ask-zeroindex` | **Hand-edit `golden-seed.json`** | 30 items, ~5 minutes, eyeballs every entry once. Codemod is busywork at this scale. |
| License | **MIT** | Matches `mcp-pack`. No bifurcation without reason. |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Consumer project (e.g. ask-zeroindex)                 │
│                                                                          │
│   evals/                                                                 │
│   ├── golden.json    ──┐                                                 │
│   ├── subject.ts     ──┼──→  runEval({ ... })                            │
│   └── run.ts         ──┘                                                 │
│                                                                          │
│   .github/workflows/eval.yml  ──→  uses: zeroindex-ai/eval-pack/action@v1│
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      @zeroindex-ai/eval-pack                            │
│                                                                          │
│   src/core/                                                              │
│   ├── runner.ts          orchestration loop, throttle, per-item errors  │
│   ├── schema.ts          Zod schemas + types (GoldenItem, Result, ...)  │
│   ├── checks.ts          mustMention, mustNotMention, citationCount     │
│   ├── citations.ts       markerCitationExtractor, noopCitationExtractor │
│   ├── metrics.ts         recallAtK, percentile, p50, p95                │
│   └── passRule.ts        default rule + helper builders                 │
│                                                                          │
│   src/judge-claude/      Anthropic-backed Judge implementation          │
│   src/report-html/       renderHtml(results, opts) → string             │
│   src/cli/               binary `eval-pack`: flag parser, printers      │
│                                                                          │
│   exports map in package.json:                                           │
│     "."              → src/core/index.ts                                 │
│     "./judge-claude" → src/judge-claude/index.ts                         │
│     "./report-html"  → src/report-html/index.ts                         │
│     "./checks"       → src/core/checks.ts (re-export convenience)       │
│                                                                          │
│   action/              GitHub composite action (separate artifact)      │
│   ├── action.yml                                                         │
│   └── entrypoint.sh                                                      │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Outputs per run                                  │
│                                                                          │
│   stdout      — pass-rate table by category + failures dump             │
│   JSON file   — full Result[] with metadata, for diff / archival        │
│   HTML file   — single self-contained report, no client JS              │
│   exit code   — 0 if pass-rate ≥ threshold, 1 otherwise                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data flow per item

```
GoldenItem
   │
   ├─→ subject(item.question)
   │      returns: { text, retrievedRefs?, metadata? }
   │
   ├─→ citationExtractor(text)
   │      returns: string[]   (cited refs from the answer text)
   │
   ├─→ for each check: check(item, result)
   │      returns: { name, ok, detail? }
   │
   ├─→ judge.run(item, result)             [optional, but standard]
   │      returns: { appropriate, grounded, reason }
   │
   ├─→ passRule(result)
   │      returns: boolean
   │
   ▼
Result { id, category, question, text, retrievedRefs, citationRefs,
         checks, judgment, pass, metadata, timings }
```

---

## 4. Public API contracts

### Core types (`src/core/schema.ts`)

```ts
export type GoldenItem = {
  id: string;
  category: string;                   // free-form; user picks axes
  question: string;
  relevant_refs?: string[];           // opaque refs (chunk ids, doc URIs, tool names)
  must_mention?: string[];
  must_not_mention?: string[];
  expect_refusal?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export type GoldenSet = {
  version: '1.0';
  items: GoldenItem[];
};

export type AnswerResult = {
  text: string;
  retrievedRefs?: string[];           // what your retriever returned, if RAG
  metadata?: Record<string, unknown>; // anywhere to stash timings, tool calls, etc.
};

export type Subject = (question: string) => Promise<AnswerResult>;

export type CitationExtractor = (text: string) => string[];

export type CheckResult = {
  name: string;
  ok: boolean;
  detail?: Record<string, unknown>;
};

export type Check = (item: GoldenItem, result: PartialResult) => CheckResult;

export type Judgment = {
  appropriate: 'yes' | 'no' | 'partial';
  grounded: 'yes' | 'no' | 'na';
  reason: string;
};

export type Judge = {
  name: string;
  run: (item: GoldenItem, result: PartialResult) => Promise<Judgment>;
};

export type Result = {
  id: string;
  category: string;
  question: string;
  text: string;
  retrievedRefs: string[];
  citationRefs: string[];
  recallAtK: number | null;           // null if relevant_refs absent
  checks: CheckResult[];
  judgment: Judgment | null;          // null if no judge configured
  pass: boolean;
  timings: { retrievalMs?: number; firstTokenMs?: number; totalMs: number };
  metadata: Record<string, unknown>;
};
```

### Runner entrypoint

```ts
import { runEval, claudeJudge } from '@zeroindex-ai/eval-pack';
import { mustMention, mustNotMention, citationCount } from '@zeroindex-ai/eval-pack/checks';
import { markerCitationExtractor } from '@zeroindex-ai/eval-pack';

const subject: Subject = async (question) => {
  const chunks = await hybridSearch(question);
  const text = await streamAnswer(question, chunks);
  return { text, retrievedRefs: chunks.map(c => String(c.id)) };
};

const results = await runEval({
  golden: 'evals/golden.json',
  subject,
  citationExtractor: markerCitationExtractor(/\[chunk:(\d+)\]/g),
  checks: [
    mustMention(),
    mustNotMention(),
    citationCount({ min: 1, skipWhen: item => item.expect_refusal === true }),
  ],
  judge: claudeJudge({ model: 'claude-sonnet-4-6' }),
  throttleMs: Number(process.env.EVAL_THROTTLE_MS ?? 0),
  resultsDir: 'evals/results',
  filter: { category: 'positive', limit: 5 },
});
```

### Built-in checks (v0.1)

| Check | Reads from item | Logic |
|---|---|---|
| `mustMention(opts?)` | `item.must_mention` | Case-insensitive substring on every term; ok if all present |
| `mustNotMention(opts?)` | `item.must_not_mention` | Case-insensitive substring on every term; ok if none present |
| `citationCount({ min, skipWhen? })` | `result.citationRefs.length` | `count >= min`; auto-skip if `skipWhen(item) === true` |
| `expectRefusal()` | `item.expect_refusal` | Heuristic refusal detection (configurable phrase list); ok if `expected === actual` |

### CLI surface

```
eval-pack run [options]

Options:
  --golden <path>          Path to golden JSON          (default: evals/golden.json)
  --subject <path>         TS/JS file exporting a `subject` function
  --judge <name>           "claude" | "none"            (default: claude)
  --judge-model <id>       Override judge model         (default: claude-sonnet-4-6)
  --threshold <ratio>      Pass-rate threshold 0–1      (default: from env, else none)
  --filter <key=value>     Filter golden items, e.g. category=positive (repeatable)
  --limit <n>              Max items to run
  --throttle-ms <n>        Sleep between items          (default: env EVAL_THROTTLE_MS or 0)
  --results-dir <path>     Where to write run JSON      (default: evals/results)
  --html-out <path>        Write HTML report to path    (optional)
  --quiet                  Suppress stdout table
```

Exit codes: `0` on threshold met, `1` on threshold missed, `2` on usage error, `3` on all-items-errored.

---

## 5. Golden schema (v1.0)

```json
{
  "version": "1.0",
  "items": [
    {
      "id": "services-list",
      "category": "positive",
      "question": "What services does ZeroIndex offer?",
      "relevant_refs": ["3", "4", "5", "10", "11", "12", "13", "14", "15"],
      "must_mention": ["audit", "build"],
      "must_not_mention": [],
      "expect_refusal": false,
      "tags": ["services"],
      "metadata": {}
    }
  ]
}
```

### Migration from `ask-zeroindex/evals/golden-seed.json`

1. Wrap the bare array in `{ "version": "1.0", "items": [...] }`.
2. Rename `relevant_chunk_ids: number[]` → `relevant_refs: string[]` (stringify each id).
3. Done. Other fields preserved verbatim.

Hand-edit per the resolved decision in §2. ~5 minutes.

---

## 6. HTML report

One self-contained `.html` file per run. No client JS, no CDN dependencies, no external CSS.

Contents:

- **Header** — project name, model, timestamp, total pass rate (vs threshold if provided), total items, total errored
- **Category table** — same shape as the stdout summary, rendered as a styled HTML table
- **Failures section** — one `<details>` per failing item: question, full answer text, retrieved refs, cited refs, every check's name + ok + detail, judge's appropriate/grounded/reason
- **Successes section** — collapsed `<details>` listing passing items (id, category, p50 timing), available for forensics but quiet by default
- **Footer** — source JSON path, eval-pack version, generation timestamp, link back to `zeroindex.ai`

### Design constraints

- Renders cleanly when opened with `file://` (no server)
- Embeds cleanly via `<iframe>` from `zeroindex.ai` (no parent-window dependencies)
- Survives long-term archival (no font CDNs, no analytics)
- One file = one run; no multi-run dashboards (that belongs in a separate dashboard tool, not in this library)

The optional `redact?: (item, result) => Result` hook lets a future consumer strip sensitive content before rendering. Stubbed in v0.1.

---

## 7. GitHub composite action

```
action/
├── action.yml
└── entrypoint.sh
```

Project workflows shrink from ~35 lines to:

```yaml
- uses: zeroindex-ai/eval-pack/action@v1
  with:
    golden: evals/golden.json
    subject: ./evals/subject.ts
    threshold: '0.8'
    html-out: evals/results/latest.html
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    # plus whatever env the user's subject needs (e.g. VOYAGE_API_KEY, TURSO_*)
```

The action handles pnpm + Node setup, install, run, artifact upload, and threshold gating. Versioned via git tags on the monorepo (`v1` is a moving tag; `v0.1.0` is pinned).

---

## 8. Repository layout

```
eval-pack/
├── src/
│   ├── core/
│   │   ├── index.ts              barrel: runEval + types + util re-exports
│   │   ├── runner.ts             runEval orchestration loop
│   │   ├── schema.ts             Zod schemas + types
│   │   ├── checks.ts             4 built-in checks
│   │   ├── citations.ts          marker + noop extractors
│   │   ├── metrics.ts            recallAtK, p50, p95 (lifted from ask-zeroindex)
│   │   ├── metrics.test.ts       (lifted from ask-zeroindex)
│   │   └── passRule.ts           default rule
│   ├── judge-claude/
│   │   ├── index.ts              claudeJudge() factory
│   │   ├── prompt.ts             JUDGE_SYSTEM + per-item prompt template
│   │   └── parse.ts              Zod-validated JSON parser
│   ├── report-html/
│   │   ├── index.ts              renderHtml(results, opts) → string
│   │   ├── template.ts           the HTML scaffold
│   │   └── styles.ts             inlined CSS as a string
│   └── cli/
│       ├── bin.ts                #!/usr/bin/env node — entry
│       ├── parseArgs.ts          tiny --flag parser
│       └── printers/
│           ├── stdout.ts
│           ├── json.ts
│           └── html.ts           thin wrapper around report-html
├── action/
│   ├── action.yml                GitHub composite action manifest
│   └── entrypoint.sh             pnpm install + eval-pack run + artifact upload
├── examples/
│   ├── ask-zeroindex/            link or copy of the real consumer config
│   └── dummy-agent/              non-RAG smoke example
├── package.json                  bin: { "eval-pack": "./dist/cli/bin.js" }, exports map
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.mjs
├── .github/workflows/ci.yml      typecheck + lint + test on PRs
├── PROJECT.md                    this file
├── README.md                     user-facing intro + install snippet
└── LICENSE                       MIT
```

---

## 9. Ordered work list

**Status as of 2026-05-14:** v0.1 work-list complete. All 17 items shipped — v0.1.0 and v0.1.1 published to npm; `ask-zeroindex` dogfoods the package end-to-end (90% pass-rate baseline, 97% on the latest scheduled run); `evals.zeroindex.ai` live serving HTML reports.

1. ✅ **Scaffold the repo.** `pnpm init` private; `pnpm-workspace.yaml` reserved for future even though v0.1 is single-package; `tsconfig.json`, ESLint, Vitest, CI workflow; empty `src/` tree matching the layout in §8; MIT `LICENSE`; placeholder `README.md`.
2. ✅ **Lift `metrics.ts` and `metrics.test.ts`** from `ask-zeroindex/evals/` verbatim into `src/core/`. Green vitest run is the first commit signal.
3. ✅ **Define contracts in `src/core/schema.ts`** — every type from §4, Zod schemas for `GoldenSet` and `Judgment` JSON, exported types.
4. ✅ **Implement the 4 built-in checks** in `src/core/checks.ts` with vitest tests against fabricated `Result` shapes. No LLM calls in any test.
5. ✅ **Implement `src/core/citations.ts`** — `markerCitationExtractor(regex)` and `noopCitationExtractor`. Unit-tested.
6. ✅ **Implement `src/core/passRule.ts`** — default rule + a small helper for users to compose category-conditional rules.
7. ✅ **Implement `src/core/runner.ts`** — the orchestration loop. Throttling, per-item error capture, summary aggregation, results JSON write. Unit-test with a fake subject and a fake judge; assert pass-rate math and per-item error isolation.
8. ✅ **Ship `src/judge-claude/`** — port the existing `judgeAnswer` prompt unchanged for fidelity. Add a Zod-validated JSON parser. Wire `model` and `system` as factory options.
9. ✅ **Ship `src/report-html/`** — accept `Result[]` + run metadata, return a string. Snapshot test on a fixture.
10. ✅ **Ship `src/cli/`** — flag parsing, dynamic import of user's subject file via `tsx` runtime, compose stdout + JSON + HTML printers, exit-code logic, threshold gate.
11. ✅ **Port `ask-zeroindex/evals/`** to consume `eval-pack`. Migrate `golden-seed.json` schema. Replace inlined `run.ts` with a thin `evals/subject.ts` + `evals/eval.config.ts`. Run targeting ≥90% pass rate. Delete the inlined harness.
12. ✅ **Add `examples/dummy-agent/`** — 4–5 golden items, a static-lookup subject, no LLM judge. Proves the harness works for a non-RAG case.
13. ✅ **Ship `action/`** — composite action YAML + `entrypoint.sh`. First consumer: `ask-zeroindex/.github/workflows/eval.yml` shrinks to ~10 lines.
14. ✅ **Publish v0.1.0 to npm.** Shipped 0.1.0 and 0.1.1 (the 0.1.1 patch added `default` to subpath exports — caught by the ask-zeroindex dogfood when tsx couldn't resolve the package). Configure `exports` map, `bin`, `files`. Tag the monorepo `v0.1.0` and a moving `v1` tag for the action. CI gates publish on green typecheck + lint + tests.
15. ✅ **Stand up `zeroindex-ai/evals-site`** as a Cloudflare Workers Static Assets site. CI in `ask-zeroindex` commits the HTML report on each successful eval.
16. ✅ **Link eval-pack from the ZeroIndex website** — stack-list pill + a link to the live reports.
17. ✅ **Top-level README + per-area docs.** Value-prop, install snippet, minimal usage, link to `evals.zeroindex.ai` as the live proof.

---

## 10. Operational runbook

### Local development

```bash
pnpm install
pnpm typecheck                        # tsc --noEmit
pnpm lint
pnpm test                             # vitest
pnpm build                            # tsc → dist/

# run the bundled CLI against a local subject
pnpm exec eval-pack run \
  --golden examples/dummy-agent/golden.json \
  --subject examples/dummy-agent/subject.ts \
  --judge none
```

### Adding a new built-in check

1. Add the function to `src/core/checks.ts`.
2. Export it from the barrel.
3. Add unit tests in `src/core/checks.test.ts`.
4. Document the check in the README's "Built-in checks" table.

### Adding a new judge (v0.2+)

1. Create `src/judge-<provider>/` matching the `judge-claude/` layout.
2. Implement the `Judge` interface from `src/core/schema.ts`.
3. Add a subpath export in `package.json`: `"./judge-<provider>": "./dist/judge-<provider>/index.js"`.
4. Add the CLI's `--judge` flag option.
5. Snapshot test the prompt.

### Cutting a release

1. Confirm green CI on main.
2. Update CHANGELOG.
3. `pnpm version <patch|minor|major>` → tag → push.
4. CI publishes to npm and updates the moving `v1` action tag.

---

## 11. Decision log (running)

| Date | Decision | Why |
|---|---|---|
| 2026-05-12 | Single-package monorepo, not 5-package | Dep graph is artificial here; pieces always ship together. Different from `mcp-pack` where vendor APIs are genuinely independent. |
| 2026-05-12 | Claude judge only in v0.1; AI SDK adapter deferred | Adapter design needs a second provider to validate against. Premature otherwise. |
| 2026-05-12 | RAG-first; agent primitives in v0.2 | Allows v0.1 to be a clean lift-and-shift from `ask-zeroindex`. Agent shapes get designed against `repo-xray`'s real needs. |
| 2026-05-12 | Standalone HTML report, no live dashboard | Live dashboards are `trace-pack`'s territory. eval-pack outputs files. |
| 2026-05-12 | Cloudflare Workers Static Assets for `evals.zeroindex.ai` | Same pattern as `zeroindex.ai`. R2 deferred until scale demands it. |
| 2026-05-12 | Full answer text in HTML report; redaction hook stubbed | Only public consumer (`ask-zeroindex`) is non-sensitive. Premature redaction layers rot. |
| 2026-05-12 | Hand-edit `golden-seed.json` schema migration | 30 items, ~5 min, eyeballs every entry once. |
| 2026-05-12 | MIT license | Matches `mcp-pack`. No bifurcation without reason. |

---

## 12. Known constraints & future work

### v0.1 known constraints

- **Single LLM provider for judging.** Claude only. Adapter contract exists in `core/schema.ts` so v0.2 is additive.
- **No regression detection.** A passing run replaces the previous one in `evals.zeroindex.ai`. v0.2 introduces run history.
- **Subject file is dynamically imported via `tsx`.** Adds a runtime dep on `tsx` for the CLI. Acceptable for v0.1; reconsider if any consumer ships JS-only.
- **Throttling is global per run.** No per-resource (Voyage / Anthropic / custom) throttle policy. The single knob covers `ask-zeroindex`'s Voyage free-tier case; richer policies wait for a real second use case.

### v0.2 candidate work

- `@zeroindex-ai/eval-pack/judge-openai` (and a real adapter contract)
- Agent eval primitives: `expectToolCall(name, args)`, `trajectoryMatches(steps)`, `maxStepsCheck(n)`
- Run-over-run diffing and regression report
- Per-category threshold gating
- HTML report multi-run timeline view (or punt to a dedicated dashboard tool)
- Built-in support for embeddings-similarity checks (cosine ≥ threshold against gold answer)

### v1.0 candidate work

- Public spec for the golden-set schema with a stable JSON Schema URL
- Stable API contract; semver guarantees
- More provider adapters; an opinionated default if a user passes `judge: 'auto'`
- Integration with companion observability tooling (`eval-pack` run could emit structured events for ingestion by a live dashboard)

---

## 13. Cross-references

- **Source of the lift-and-shift code:** [`zeroindex-ai/ask-zeroindex/evals/`](https://github.com/zeroindex-ai/ask-zeroindex/tree/main/evals)
- **Source of the methodology writeup:** [`zeroindex-ai/ask-zeroindex/eval-baselines.md`](https://github.com/zeroindex-ai/ask-zeroindex/blob/main/eval-baselines.md)
- **Website repo:** [`zeroindex-ai/zeroindexai`](https://github.com/zeroindex-ai/zeroindexai)
- **This repo (planned):** [`zeroindex-ai/eval-pack`](https://github.com/zeroindex-ai/eval-pack)
- **Live site:** `evals.zeroindex.ai` (planned)

---

*This document is a living artifact. Update it when scope, contracts, or decisions change materially.*

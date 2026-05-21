# Changelog

All notable changes to `@zeroindex-ai/eval-pack` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file closes the release-runbook step at [PROJECT.md §10](./PROJECT.md) ("Update CHANGELOG").

## [Unreleased]

## [0.3.0] - 2026-05-20

### Changed

- **BREAKING:** The `Result`/`PartialResult` field `recallAtK` is renamed to
  `recall`, and the exported metric function `recallAtK` is renamed to
  `recall`. The metric was never top-K: it computes set-recall
  (`|relevant ∩ retrieved| / |relevant|`) over the entire retrieved set with
  no `K` parameter and no truncation. The name now reflects that. The HTML
  report label changes from "Recall@K" to "Recall". Consumers reading
  `result.recallAtK` or importing the `recallAtK` function must update to
  `recall`.
- Enabled `verbatimModuleSyntax` and `noFallthroughCasesInSwitch` in
  `tsconfig.json` (no source change — the code was already `import type`-clean).
- The self-contained HTML report footer now includes the
  `@zeroindex-ai/eval-pack` version, read from the package's own
  `package.json` with an `'unknown'` fallback. The version read is lazy (on
  first `renderHtml` call), so importing `./report-html` is side-effect-free.

### Added

- `prepublishOnly: "pnpm build && pnpm test"` so the documented manual-publish
  fallback can't ship a stale or untested `dist/`.
- The CLI now warns on `stderr` when `--filter` is passed an unrecognized key
  (e.g. a typo), naming the unknown key(s) and the known ones, instead of
  silently running the full set.

### Fixed

- Corrected the runnable CLI invocation in the README and HELP text to
  `tsx node_modules/.bin/eval-pack run ...` (the bin shebang is `node`); the
  prior `tsx eval-pack run` form was not literally runnable.
- `release.yml` now derives the GitHub Release CHANGELOG anchor from the
  changelog heading (with a bare-version fallback) so the "See CHANGELOG" link
  resolves.
- Documentation/`--filter` accuracy: `--filter` is documented as one-per-key
  (repeated same-key filters overwrite, they do not accumulate); the
  `defaultPassRule` JSDoc now describes the actual blacklist logic; `p50`/`p95`/
  `percentile` are documented as exported utilities not surfaced in the default
  report; `expectRefusal` carries a coarse-English-heuristic caveat; removed a
  ghost `examples/ask-zeroindex/` entry from the layout diagram.

## [0.2.0] - 2026-05-16

### Changed

- **BREAKING:** `@anthropic-ai/sdk` moved from `dependencies` to
  `peerDependencies` (optional). Consumers using the Claude judge must now
  install `@anthropic-ai/sdk` directly. Consumers using `--judge none` no
  longer pull it in. The CLI now imports the Claude judge dynamically so
  `--judge none` runs cleanly when the SDK is not installed.

### Added

- Tag-driven `release.yml` GitHub Actions workflow for automated
  `npm publish` with provenance. Pushing a `v*` tag now runs build + test +
  version-tag-match check, then publishes with `--provenance --access public`
  and cuts a GitHub Release.

## [0.1.1] - 2026-05-13

### Added

- `default` condition on every subpath export in `package.json` so resolvers
  that don't recognise the `import` condition (older bundlers, some test
  runners) still resolve the ESM entrypoint instead of failing with
  "No matching export."

## [0.1.0] - 2026-05-13

Initial public release. Lift-and-shift of the LLM-as-judge + programmatic-checks
pipeline that runs inside `ask-zeroindex`, generalised into a reusable package.

### Added

- Core contracts and types: `Subject`, `Judge`, `GoldenItem`, `GoldenSet`,
  `Result`, `PartialResult`, `Check`, `CheckResult`, `Judgment`, with Zod
  schemas at the two trust boundaries (golden JSON, judge response).
- Built-in checks: `mustMention`, `mustNotMention`, `citationCount`,
  `expectRefusal`.
- Citation extractors: `markerCitationExtractor` (with global-flag enforcement)
  and `noopCitationExtractor`.
- `runEval` orchestrator with golden-set loading, throttle handling, per-item
  error isolation, filter/limit, optional JSON persistence, and event hooks.
- `defaultPassRule` and `byCategory` pass-rule helpers.
- Claude judge (`claudeJudge` factory) with default prompt builders, markdown
  fence-stripping for LLM JSON output, configurable model / system prompt /
  category guidance / max tokens, and an injectable Anthropic client for
  testing.
- Standalone HTML report renderer (`renderHtml`): single self-contained file,
  inline CSS, no client JS, XSS-safe escaping, optional `redact` hook.
- CLI binary `eval-pack` with a `run` subcommand, `--flag value` and
  `--flag=value` forms, documented exit codes (0 pass, 1 below threshold,
  2 usage error, 3 every item errored), and env-var fallbacks
  (`EVAL_PASS_THRESHOLD`, `EVAL_THROTTLE_MS`).
- Subpath exports: `.`, `./checks`, `./judge-claude`, `./report-html`.
- GitHub composite action at `action/` published as
  `zeroindex-ai/eval-pack/action@v1` — sets up pnpm + Node, runs
  `pnpm install --frozen-lockfile`, invokes the CLI via `tsx`, and uploads
  JSON + HTML reports as workflow artifacts (always, even on failure).
- Runnable non-RAG example under `examples/dummy-agent/` (offline, no API
  keys required).
- CI matrix across Node 20, 22, 24.

[Unreleased]: https://github.com/zeroindex-ai/eval-pack/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/zeroindex-ai/eval-pack/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/zeroindex-ai/eval-pack/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/zeroindex-ai/eval-pack/releases/tag/v0.1.0

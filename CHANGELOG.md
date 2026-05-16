# Changelog

All notable changes to `@zeroindex-ai/eval-pack` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file closes the release-runbook step at [PROJECT.md §10](./PROJECT.md) ("Update CHANGELOG").

## [Unreleased]

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

[Unreleased]: https://github.com/zeroindex-ai/eval-pack/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/zeroindex-ai/eval-pack/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/zeroindex-ai/eval-pack/releases/tag/v0.1.0

# @zeroindex-ai/eval-pack — agent guide

Opinionated, dependency-light eval harness for RAG and agent applications built on Claude. Published to npm as a single package. tsc→dist, no bundler.

The *why* and the public API live in `PROJECT.md`.

## Guardrails (do not violate)

- **Never commit secrets** (`NPM_TOKEN` lives in CI, not the repo) — check before `git add -A`.
- **Public repo → sanitize docs** (no machine paths, vault names, private-memory refs).
  The `md-review-gate` hook enforces it.
- **Branch before the first commit** — confirm `git branch`.
- **Don't break the public API silently.** Any change to an exported entrypoint (`.`, `./checks`,
  `./judge-claude`, `./report-html`), a core type, or a CLI flag is a semver event — update
  CHANGELOG.md + bump appropriately.
- **Docs must match the artifact.** README/JSDoc claims that lag the shipped code are
  the #1 credibility finding — fix all copies (README, PROJECT.md, CHANGELOG.md, in-source
  JSDoc, and the `action/action.yml` reference) when behavior changes.

## Commands

```bash
pnpm install
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint
pnpm test          # vitest
pnpm build         # tsc → dist/   (no bundler)
```

Release (tag-driven, do not `npm publish` by hand):
```bash
# 1. bump version + update CHANGELOG.md, commit
# 2. tag matching package.json version → release.yml verifies tag==version,
#    publishes with --provenance --access public, cuts a GitHub Release
git tag vX.Y.Z && git push --tags
```

`prepublishOnly` runs `pnpm build && pnpm test` so the documented manual-publish fallback can't ship a stale or untested `dist/`.

## Conventions & gotchas

- **tsc-to-dist, ESM, no bundler.** `files` whitelist in package.json, `prepublishOnly` gate,
  `packageManager: pnpm@10.0.0`, semantic CLI exit codes (`0` pass, `1` below threshold,
  `2` usage error, `3` every item errored).
- **Optional peer dep loads dynamically.** `@anthropic-ai/sdk` is an optional `peerDependency`
  (`peerDependenciesMeta.optional`); the CLI and judge `import()` it lazily so the package
  installs and runs `--judge none` cleanly when the SDK is absent.
- **Tag-driven provenance release.** `release.yml` derives the GitHub Release CHANGELOG anchor
  from the changelog heading (bare-version fallback); pushing a `v*` tag verifies tag==package.json
  version before publishing.
- **CLI/tsx shebang gotcha.** The published `bin` (`dist/cli/bin.js`) has a `node` shebang, so TS
  subject files need `tsx` pointed at the bin directly:
  `pnpm exec tsx node_modules/.bin/eval-pack run ...` (this is exactly what the GitHub composite
  action does). The `tsx eval-pack run` form is not literally runnable.

## Where to look

- `PROJECT.md` — design, public contract, decision log, ordered work list.
- `CHANGELOG.md` — Keep a Changelog format; every release documented.
- `README.md` — the public pitch + install + quick-start.
- `action/action.yml` — the GitHub composite action reference.

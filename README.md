# @zeroindex-ai/eval-pack

Opinionated open-source eval harness for RAG and agent applications built on Claude. By [ZeroIndex LLC](https://zeroindex.ai).

> **Status: pre-release.** v0.1 in active development. See [PROJECT.md](./PROJECT.md) for the design, decisions, and ordered work list.

## What this is

The generalization of the LLM-as-judge + programmatic-checks pipeline that runs inside [`ask-zeroindex`](https://github.com/zeroindex-ai/ask-zeroindex). Distributed as a single npm package with subpath exports plus a companion GitHub composite action.

Three things you'd otherwise build yourself:

1. A **golden-set runner** with throttle handling, error isolation per item, and threshold gating
2. A **judge** abstraction (Claude-backed in v0.1) and built-in **programmatic checks** (`mustMention`, `mustNotMention`, `citationCount`, `expectRefusal`)
3. A **standalone HTML report renderer** that produces one self-contained file per run — suitable for CI artifacts, browser-local viewing, or iframe embedding

## Install (not yet published)

```bash
pnpm add -D @zeroindex-ai/eval-pack
```

## Develop

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## License

MIT — see [LICENSE](./LICENSE).

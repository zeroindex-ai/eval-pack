#!/usr/bin/env bash
# Invokes the eval-pack CLI with arguments assembled from action inputs.
# Always runs via `tsx` so TypeScript subject files work transparently
# alongside JS subjects. `tsx` is required as a devDependency in the
# consumer's package.json.

set -euo pipefail

if ! pnpm exec tsx --version >/dev/null 2>&1; then
  echo "::error::tsx not found. Add tsx as a devDependency to your package.json:"
  echo "        pnpm add -D tsx"
  exit 2
fi

ARGS=(run)
ARGS+=(--golden "$EVAL_PACK_GOLDEN")
ARGS+=(--subject "$EVAL_PACK_SUBJECT")
ARGS+=(--judge "$EVAL_PACK_JUDGE")
ARGS+=(--judge-model "$EVAL_PACK_JUDGE_MODEL")

if [ -n "$EVAL_PACK_THRESHOLD" ]; then
  ARGS+=(--threshold "$EVAL_PACK_THRESHOLD")
fi
if [ -n "$EVAL_PACK_FILTER" ]; then
  # Allow multiple --filter values, one per line
  while IFS= read -r f; do
    [ -n "$f" ] && ARGS+=(--filter "$f")
  done <<<"$EVAL_PACK_FILTER"
fi
if [ -n "$EVAL_PACK_LIMIT" ]; then
  ARGS+=(--limit "$EVAL_PACK_LIMIT")
fi
if [ -n "$EVAL_PACK_THROTTLE_MS" ]; then
  ARGS+=(--throttle-ms "$EVAL_PACK_THROTTLE_MS")
fi
if [ -n "$EVAL_PACK_RESULTS_DIR" ]; then
  ARGS+=(--results-dir "$EVAL_PACK_RESULTS_DIR")
fi
if [ -n "$EVAL_PACK_HTML_OUT" ]; then
  ARGS+=(--html-out "$EVAL_PACK_HTML_OUT")
fi

echo "::group::eval-pack invocation"
echo "pnpm exec tsx node_modules/.bin/eval-pack ${ARGS[*]}"
echo "::endgroup::"

exec pnpm exec tsx node_modules/.bin/eval-pack "${ARGS[@]}"

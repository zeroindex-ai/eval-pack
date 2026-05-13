// Eval metrics: recall@K for retrieval ablation and percentile (p50/p95)
// for latency aggregation. Pure functions, no dependencies.

export function recallAtK<T>(retrieved: readonly T[], relevant: readonly T[]): number {
  if (relevant.length === 0) return 1;
  const set = new Set<T>(retrieved);
  return relevant.filter((id) => set.has(id)).length / relevant.length;
}

// Index-based percentile (no interpolation) — fine for 10–30 sample sizes.
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx]!;
}

export const p50 = (values: number[]): number => percentile(values, 0.5);
export const p95 = (values: number[]): number => percentile(values, 0.95);

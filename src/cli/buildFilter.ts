import type { RunFilter } from '../core/runner.js';

// Filter keys honored by buildFilter. A typo'd `--filter` key (e.g.
// `categroy=positive`) parses fine in parseArgs but isn't one of these, so it
// would otherwise be silently dropped and the full set would run with no
// signal. buildFilter warns on any unrecognized key instead.
const KNOWN_FILTER_KEYS = ['category', 'tags'] as const;

/**
 * Translate the parsed `--filter` record (plus an optional `--limit`) into a
 * RunFilter. Only `category` and `tags` are honored. Any other key is ignored
 * but reported via `onWarn` (defaults to stderr) so a typo is visible rather
 * than silently swallowed.
 */
export function buildFilter(
  filter: Record<string, string>,
  limit: number | undefined,
  onWarn: (message: string) => void = (m) => process.stderr.write(`${m}\n`)
): RunFilter {
  const known = new Set<string>(KNOWN_FILTER_KEYS);
  const unknown = Object.keys(filter).filter((k) => !known.has(k));
  if (unknown.length > 0) {
    onWarn(
      `Warning: ignoring unknown --filter key(s): ${unknown.join(', ')} ` +
        `(known: ${KNOWN_FILTER_KEYS.join(', ')})`
    );
  }

  const out: RunFilter = {};
  if (filter['category'] !== undefined) out.category = filter['category'];
  if (filter['tags'] !== undefined) out.tags = filter['tags'].split(',');
  if (limit !== undefined) out.limit = limit;
  return out;
}

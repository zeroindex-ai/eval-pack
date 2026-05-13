// Manual flag parser for the eval-pack CLI. Per PROJECT.md §3, we avoid
// commander / yargs at <8 flags — this stays a small dependency-free
// surface that's easy to test.

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export type ParsedArgs = {
  golden?: string;
  subject?: string;
  judge?: 'claude' | 'none';
  judgeModel?: string;
  threshold?: number;
  filter: Record<string, string>;
  limit?: number;
  throttleMs?: number;
  resultsDir?: string;
  htmlOut?: string;
  quiet: boolean;
  help: boolean;
};

const KNOWN_FLAGS = new Set([
  '--golden',
  '--subject',
  '--judge',
  '--judge-model',
  '--threshold',
  '--filter',
  '--limit',
  '--throttle-ms',
  '--results-dir',
  '--html-out',
]);

const BOOL_FLAGS = new Set(['--quiet', '--help', '-h']);

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const out: ParsedArgs = { filter: {}, quiet: false, help: false };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i]!;

    if (arg === '--help' || arg === '-h') {
      out.help = true;
      i += 1;
      continue;
    }
    if (arg === '--quiet') {
      out.quiet = true;
      i += 1;
      continue;
    }

    let flag: string;
    let value: string | undefined;

    if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=');
      flag = arg.slice(0, eq);
      value = arg.slice(eq + 1);
      i += 1;
    } else {
      flag = arg;
      value = argv[i + 1];
      i += 2;
    }

    if (BOOL_FLAGS.has(flag)) {
      throw new UsageError(`Boolean flag ${flag} does not take a value`);
    }
    if (!KNOWN_FLAGS.has(flag)) {
      throw new UsageError(`Unknown flag: ${flag}`);
    }
    if (value === undefined || value.startsWith('--')) {
      throw new UsageError(`Missing value for ${flag}`);
    }

    switch (flag) {
      case '--golden':
        out.golden = value;
        break;
      case '--subject':
        out.subject = value;
        break;
      case '--judge':
        if (value !== 'claude' && value !== 'none') {
          throw new UsageError(`--judge must be "claude" or "none", got ${value}`);
        }
        out.judge = value;
        break;
      case '--judge-model':
        out.judgeModel = value;
        break;
      case '--threshold': {
        const n = Number(value);
        if (Number.isNaN(n) || n < 0 || n > 1) {
          throw new UsageError(`--threshold must be a number in [0,1], got ${value}`);
        }
        out.threshold = n;
        break;
      }
      case '--filter': {
        const eq = value.indexOf('=');
        if (eq <= 0) {
          throw new UsageError(`--filter must be key=value, got ${value}`);
        }
        out.filter[value.slice(0, eq)] = value.slice(eq + 1);
        break;
      }
      case '--limit': {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1) {
          throw new UsageError(`--limit must be a positive integer, got ${value}`);
        }
        out.limit = n;
        break;
      }
      case '--throttle-ms': {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0) {
          throw new UsageError(`--throttle-ms must be a non-negative number, got ${value}`);
        }
        out.throttleMs = n;
        break;
      }
      case '--results-dir':
        out.resultsDir = value;
        break;
      case '--html-out':
        out.htmlOut = value;
        break;
    }
  }

  return out;
}

export const HELP = `Usage: eval-pack run [options]

Options:
  --golden <path>          Path to golden JSON (default: evals/golden.json)
  --subject <path>         JS file exporting a 'subject' function (required).
                           For TypeScript subjects, invoke the CLI via
                           'tsx eval-pack run ...' or pre-compile to JS.
  --judge <name>           "claude" or "none" (default: claude)
  --judge-model <id>       Override judge model (default: claude-sonnet-4-6)
  --threshold <ratio>      Pass-rate threshold 0–1 (default: env EVAL_PASS_THRESHOLD or none)
  --filter <key=value>     Filter golden items (repeatable). Keys: category, tags
  --limit <n>              Max items to run
  --throttle-ms <n>        Sleep between items (default: env EVAL_THROTTLE_MS or 0)
  --results-dir <path>     Where to write run JSON (default: evals/results)
  --html-out <path>        Write HTML report to this path
  --quiet                  Suppress per-item stdout
  --help, -h               Show this help

Exit codes:
  0  pass rate >= threshold (or no threshold set)
  1  pass rate < threshold
  2  usage error
  3  every item errored
`;

#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runEval, type RunFilter } from '../core/runner.js';
import { renderHtml } from '../report-html/index.js';
import type { Judge, Subject } from '../core/schema.js';
import {
  HELP,
  UsageError,
  parseArgs,
  resolveThreshold,
  resolveThrottleMs,
} from './parseArgs.js';
import { printSummary } from './stdoutPrinter.js';

async function loadSubject(path: string): Promise<Subject> {
  const absolute = isAbsolute(path) ? path : resolve(process.cwd(), path);
  const mod = (await import(pathToFileURL(absolute).href)) as Record<string, unknown>;
  const subject = mod['subject'] ?? mod['default'];
  if (typeof subject !== 'function') {
    throw new Error(
      `Subject file ${path} must export a 'subject' function or default. ` +
        `For TypeScript subjects, invoke via 'tsx eval-pack run ...' or pre-compile to JS.`,
    );
  }
  return subject as Subject;
}

function buildFilter(filter: Record<string, string>, limit: number | undefined): RunFilter {
  const out: RunFilter = {};
  if (filter['category'] !== undefined) out.category = filter['category'];
  if (filter['tags'] !== undefined) out.tags = filter['tags'].split(',');
  if (limit !== undefined) out.limit = limit;
  return out;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  // First positional is the subcommand (only "run" today).
  let flagArgv: string[];
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    console.log(HELP);
    return;
  }
  if (argv[0] === 'run') {
    flagArgv = argv.slice(1);
  } else if (argv[0]!.startsWith('-')) {
    flagArgv = argv;
  } else {
    throw new UsageError(`Unknown subcommand: ${argv[0]}. Try 'eval-pack --help'.`);
  }

  const args = parseArgs(flagArgv);
  if (args.help) {
    console.log(HELP);
    return;
  }
  if (args.subject === undefined) {
    throw new UsageError("--subject is required. See 'eval-pack --help'.");
  }

  const subject = await loadSubject(args.subject);
  const goldenPath = args.golden ?? 'evals/golden.json';

  // Dynamically import the Claude judge only when needed. `@anthropic-ai/sdk`
  // is an optional peerDependency as of 0.2.0 — consumers using `--judge none`
  // must not pay the SDK import cost (or fail at module load if the SDK
  // isn't installed).
  const useClaude = (args.judge ?? 'claude') === 'claude';
  let judge: Judge | undefined;
  if (useClaude) {
    const { claudeJudge } = await import('../judge-claude/index.js');
    judge = claudeJudge(args.judgeModel !== undefined ? { model: args.judgeModel } : {});
  }

  const threshold = resolveThreshold(args.threshold, process.env['EVAL_PASS_THRESHOLD']);
  const throttleMs = resolveThrottleMs(args.throttleMs, process.env['EVAL_THROTTLE_MS']);

  const report = await runEval({
    golden: goldenPath,
    subject,
    ...(judge !== undefined ? { judge } : {}),
    throttleMs,
    resultsDir: args.resultsDir ?? 'evals/results',
    filter: buildFilter(args.filter, args.limit),
    onItem: args.quiet
      ? undefined
      : (e) => {
          if (e.type === 'pass') process.stdout.write(`  ✓ ${e.result.id}\n`);
          else if (e.type === 'fail') process.stdout.write(`  ✗ ${e.result.id}\n`);
          else if (e.type === 'error')
            process.stdout.write(`  ! ${e.item.id}: ${e.error.message}\n`);
        },
  });

  if (!args.quiet) printSummary(report, threshold);

  if (args.htmlOut !== undefined) {
    const html = renderHtml(report, threshold !== undefined ? { threshold } : {});
    await writeFile(args.htmlOut, html);
    if (!args.quiet) console.log(`\nHTML report: ${args.htmlOut}`);
  }

  if (report.results.length === 0) {
    console.error('No results — every item errored.');
    process.exit(3);
  }
  if (threshold !== undefined) {
    const passRate = report.results.filter((r) => r.pass).length / report.results.length;
    if (passRate < threshold) {
      console.error(
        `Pass rate ${(passRate * 100).toFixed(1)}% below threshold ${(threshold * 100).toFixed(0)}%`,
      );
      process.exit(1);
    }
  }
}

main().catch((err: unknown) => {
  if (err instanceof UsageError) {
    console.error(`Usage error: ${err.message}\n`);
    console.error(HELP);
    process.exit(2);
  }
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});

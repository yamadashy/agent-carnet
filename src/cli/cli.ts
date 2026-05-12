import { parseArgs } from 'node:util';
import { readConfig } from '../core/config.js';
import { CarnetError } from '../core/errors.js';
import { find as findCarnets } from '../core/find.js';
import { init } from '../core/init.js';
import { list } from '../core/list.js';
import { move } from '../core/move.js';
import { type PruneCandidate, type PruneDecision, prune } from '../core/prune.js';
import { read } from '../core/read.js';
import { remove } from '../core/rm.js';
import { save } from '../core/save.js';
import { used } from '../core/used.js';
import { parseCsv } from '../core/validate.js';
import { exitCodeFor, formatErrorHuman, formatErrorJson, toErrorShape } from '../output/error.js';
import {
  formatFindHuman,
  formatFindJson,
  formatListHuman,
  formatListJson,
  formatReadHuman,
  formatReadJson,
  formatSaveHuman,
  formatSaveJson,
} from '../output/format.js';
import { HELP_TEXT, SUBCOMMAND_HELP } from './help.js';
import { confirm, confirm3, readStdin } from './io.js';
import { getVersion } from './version.js';

interface RunFlags {
  json: boolean;
  noColor: boolean;
  noAutoPrune: boolean;
  quiet: boolean;
}

function parseGlobalFlags(argv: string[]): { rest: string[]; flags: RunFlags } {
  const out: string[] = [];
  const flags: RunFlags = { json: false, noColor: false, noAutoPrune: false, quiet: false };
  for (const a of argv) {
    if (a === '--json') flags.json = true;
    else if (a === '--no-color') flags.noColor = true;
    else if (a === '--no-auto-prune') flags.noAutoPrune = true;
    else if (a === '--quiet') flags.quiet = true;
    else out.push(a);
  }
  return { rest: out, flags };
}

function emitError(err: unknown, flags: RunFlags): never {
  const shape = toErrorShape(err);
  const text = flags.json ? formatErrorJson(shape) : formatErrorHuman(shape, !flags.noColor && process.stderr.isTTY);
  console.error(text);
  process.exit(exitCodeFor(shape.code));
}

async function runAutoPrune(cwd: string, flags: RunFlags): Promise<void> {
  const config = readConfig();
  if (!config.autoPrune || flags.noAutoPrune) return;
  try {
    const report = await prune(cwd, config, { includeTrash: true });
    if (!flags.quiet && (report.movedToTrash.length > 0 || report.hardDeleted.length > 0) && !flags.json) {
      const total = report.movedToTrash.length + report.hardDeleted.length;
      console.error(`agent-carnet: auto-pruned ${total} carnet(s)`);
    }
  } catch {
    // Auto-prune is best-effort. A storage hiccup must not block the user's
    // actual command (e.g. `save`). Swallow and let the next invocation retry.
  }
}

function helpRequested(args: string[]): boolean {
  return args.includes('-h') || args.includes('--help');
}

export async function run(argv: string[] = process.argv.slice(2)): Promise<void> {
  const { rest, flags } = parseGlobalFlags(argv);

  // Short-circuit help/version BEFORE auto-prune so they stay snappy and don't
  // touch the filesystem at all (per spec).
  if (rest.length === 0) {
    console.log(HELP_TEXT);
    return;
  }
  if (rest.includes('--version') || rest.includes('-v')) {
    console.log(getVersion());
    return;
  }
  // Top-level `--help` / `-h` (no command precedes it).
  if (rest[0] === '--help' || rest[0] === '-h') {
    console.log(HELP_TEXT);
    return;
  }

  const [command, ...args] = rest;

  // Per-subcommand help: `agent-carnet <cmd> -h` / `--help`. Falls back to the
  // global help if the command isn't recognized so users still get something
  // useful from `agent-carnet wat -h`.
  if (helpRequested(args)) {
    console.log(SUBCOMMAND_HELP[command] ?? HELP_TEXT);
    return;
  }

  const cwd = process.cwd();

  await runAutoPrune(cwd, flags);

  try {
    switch (command) {
      case 'init':
        await cmdInit(cwd, args, flags);
        return;
      case 'save':
        await cmdSave(cwd, args, flags);
        return;
      case 'list':
        await cmdList(cwd, args, flags);
        return;
      case 'find':
        await cmdFind(cwd, args, flags);
        return;
      case 'read':
        await cmdRead(cwd, args, flags);
        return;
      case 'used':
        await cmdUsed(cwd, args, flags);
        return;
      case 'move':
        await cmdMove(cwd, args, flags);
        return;
      case 'rm':
        await cmdRm(cwd, args, flags);
        return;
      case 'prune':
        await cmdPrune(cwd, args, flags);
        return;
      default:
        throw new CarnetError(
          'validation_error',
          `unknown command: ${command}`,
          'run agent-carnet --help to see available commands',
        );
    }
  } catch (e) {
    emitError(e, flags);
  }
}

// --- per-command handlers (kept small; logic lives in core/) -----------------

async function cmdInit(cwd: string, args: string[], flags: RunFlags): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: { gitignore: { type: 'boolean' } },
  });
  const result = await init(cwd, { gitignore: parsed.values.gitignore as boolean | undefined });
  if (flags.json) {
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  } else {
    console.log(`initialized: ${result.storageDir}`);
    if (result.gitignoreUpdated) console.log('updated .gitignore');
  }
}

async function cmdSave(cwd: string, args: string[], flags: RunFlags): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      summary: { type: 'string' },
      agent: { type: 'string' },
      tags: { type: 'string' },
      related: { type: 'string' },
      body: { type: 'string' },
      lifespan: { type: 'string' },
      keep: { type: 'boolean' },
      update: { type: 'boolean' },
    },
  });
  const path = parsed.positionals[0];
  if (!path) throw new CarnetError('validation_error', '<category>/<slug> is required');
  const v = parsed.values;

  const stdinBody = await readStdin();
  if (v.body !== undefined && stdinBody !== null && stdinBody !== '') {
    throw new CarnetError(
      'validation_error',
      '--body and stdin cannot be used together',
      'pass either --body or pipe to stdin, not both',
    );
  }
  const body = (v.body as string | undefined) ?? stdinBody ?? '';

  const result = await save(cwd, readConfig(), {
    path,
    summary: (v.summary as string | undefined) ?? '',
    agent: (v.agent as string | undefined) ?? '',
    body,
    tags: parseCsv(v.tags as string | undefined),
    related: parseCsv(v.related as string | undefined),
    lifespan: v.lifespan as string | undefined,
    keep: v.keep as boolean | undefined,
    update: v.update as boolean | undefined,
  });

  if (flags.json) {
    console.log(
      formatSaveJson(result.carnet.relPath, result.carnet.absPath, result.carnet.frontmatter, result.expires),
    );
  } else {
    console.log(
      formatSaveHuman(
        result.carnet.relPath,
        result.carnet.frontmatter,
        result.expires,
        !flags.noColor && process.stdout.isTTY,
      ),
    );
  }
}

async function cmdList(cwd: string, args: string[], flags: RunFlags): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      recent: { type: 'string' },
      tags: { type: 'string' },
      expiring: { type: 'string' },
      sort: { type: 'string' },
    },
  });
  const v = parsed.values;
  const sort = v.sort as string | undefined;
  const validSorts = ['last_used', 'use_count', 'updated', 'created', 'name'] as const;
  if (sort && !(validSorts as readonly string[]).includes(sort)) {
    throw new CarnetError('validation_error', `invalid --sort "${sort}"`, `one of: ${validSorts.join(', ')}`);
  }
  const recent = v.recent !== undefined ? Number(v.recent) : undefined;
  if (recent !== undefined && (!Number.isInteger(recent) || recent <= 0)) {
    throw new CarnetError('validation_error', `--recent must be a positive integer (got "${v.recent}")`);
  }
  const entries = await list(cwd, readConfig(), {
    category: parsed.positionals[0],
    recent,
    tags: parseCsv(v.tags as string | undefined),
    expiring: v.expiring as string | undefined,
    sort: sort as (typeof validSorts)[number] | undefined,
  });
  if (flags.json) console.log(formatListJson(entries));
  else console.log(formatListHuman(entries, !flags.noColor && process.stdout.isTTY));
}

async function cmdFind(cwd: string, args: string[], flags: RunFlags): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      in: { type: 'string' },
      category: { type: 'string' },
      limit: { type: 'string' },
    },
  });
  const keyword = parsed.positionals[0];
  if (!keyword) throw new CarnetError('validation_error', 'find <keyword> is required');
  const v = parsed.values;
  const scope = (v.in as string | undefined) ?? 'summary';
  if (!['summary', 'tags', 'body', 'all'].includes(scope)) {
    throw new CarnetError('validation_error', `invalid --in "${scope}"`, 'one of: summary, tags, body, all');
  }
  const limit = v.limit !== undefined ? Number(v.limit) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    throw new CarnetError('validation_error', `--limit must be a positive integer`);
  }
  const hits = await findCarnets(cwd, keyword, {
    in: scope as 'summary' | 'tags' | 'body' | 'all',
    category: v.category as string | undefined,
    limit,
  });
  if (flags.json) console.log(formatFindJson(hits));
  else console.log(formatFindHuman(hits, !flags.noColor && process.stdout.isTTY));
}

async function cmdRead(cwd: string, args: string[], flags: RunFlags): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      'no-touch': { type: 'boolean' },
      'no-frontmatter': { type: 'boolean' },
    },
  });
  const path = parsed.positionals[0];
  if (!path) throw new CarnetError('validation_error', 'read <path> is required');
  const v = parsed.values;
  const carnet = await read(cwd, path, { noTouch: v['no-touch'] as boolean | undefined });
  if (flags.json) console.log(formatReadJson(carnet));
  else console.log(formatReadHuman(carnet, !v['no-frontmatter']));
}

async function cmdPrune(cwd: string, args: string[], flags: RunFlags): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean' },
      auto: { type: 'boolean' },
      interactive: { type: 'boolean' },
      'include-trash': { type: 'boolean' },
    },
  });
  const v = parsed.values;
  const interactive = v.interactive as boolean | undefined;
  if (interactive && (v.auto || flags.json)) {
    throw new CarnetError('validation_error', '--interactive cannot be combined with --auto or --json');
  }

  const onCandidate = interactive
    ? async (cand: PruneCandidate): Promise<PruneDecision> => {
        const fm = cand.carnet.frontmatter;
        const summary = typeof fm.summary === 'string' ? fm.summary : '';
        const updated = typeof fm.updated === 'string' ? fm.updated : '?';
        process.stderr.write(
          `\n${cand.carnet.relPath}\n  summary: ${summary}\n  updated: ${updated} (expired ${cand.expiredDays}d ago)\n`,
        );
        const ans = await confirm3('prune this carnet? [y/N/q] ');
        return ans;
      }
    : undefined;

  const report = await prune(cwd, readConfig(), {
    dryRun: v['dry-run'] as boolean | undefined,
    includeTrash: v['include-trash'] as boolean | undefined,
    onCandidate,
  });
  if (flags.json) {
    console.log(JSON.stringify({ ok: true, ...report }, null, 2));
  } else if (v.auto) {
    if (!flags.quiet) console.log(`pruned: ${report.movedToTrash.length}, hard-deleted: ${report.hardDeleted.length}`);
  } else {
    console.log(`moved to .trash/: ${report.movedToTrash.length}`);
    for (const p of report.movedToTrash) console.log(`  - ${p}`);
    console.log(`hard-deleted: ${report.hardDeleted.length}`);
    for (const p of report.hardDeleted) console.log(`  - ${p}`);
  }
}

async function cmdUsed(cwd: string, args: string[], flags: RunFlags): Promise<void> {
  const parsed = parseArgs({ args, allowPositionals: true, options: {} });
  const path = parsed.positionals[0];
  if (!path) throw new CarnetError('validation_error', 'used <path> is required');
  const result = await used(cwd, path);
  if (flags.json) {
    console.log(
      JSON.stringify(
        { ok: true, path: result.relPath, last_used: result.lastUsed, use_count: result.useCount },
        null,
        2,
      ),
    );
  } else {
    console.log(`used: ${result.relPath}  (last_used: ${result.lastUsed}, use_count: ${result.useCount})`);
  }
}

async function cmdMove(cwd: string, args: string[], flags: RunFlags): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: { update: { type: 'boolean' } },
  });
  const [from, to] = parsed.positionals;
  if (!from || !to) {
    throw new CarnetError('validation_error', 'move <from> <to> requires both arguments');
  }
  const result = await move(cwd, from, to, { update: parsed.values.update as boolean | undefined });
  if (flags.json) {
    console.log(JSON.stringify({ ok: true, from: result.fromRel, to: result.toRel }, null, 2));
  } else {
    console.log(`moved: ${result.fromRel} -> ${result.toRel}`);
  }
}

async function cmdRm(cwd: string, args: string[], flags: RunFlags): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      yes: { type: 'boolean' },
      hard: { type: 'boolean' },
    },
  });
  const path = parsed.positionals[0];
  if (!path) throw new CarnetError('validation_error', 'rm <path> is required');
  const yes = parsed.values.yes as boolean | undefined;
  const hard = parsed.values.hard as boolean | undefined;

  if (!yes) {
    const prompt = hard ? `hard-delete ${path}? [y/N] ` : `rm ${path}? [y/N] `;
    const ok = await confirm(prompt);
    if (!ok) {
      if (flags.json) console.log(JSON.stringify({ ok: false, cancelled: true }, null, 2));
      else console.log('cancelled');
      return;
    }
  }

  const result = await remove(cwd, path, { hard });
  if (flags.json) {
    console.log(JSON.stringify({ ok: true, path: result.relPath, trashed: result.trashed }, null, 2));
  } else {
    const tail = result.trashed ? '-> .trash/' : '(hard delete)';
    console.log(`removed: ${result.relPath}  ${tail}`);
  }
}

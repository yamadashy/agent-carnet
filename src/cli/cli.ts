import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readConfig } from '../core/config.js';
import { CarnetError } from '../core/errors.js';
import { find as findCarnets } from '../core/find.js';
import { importFrom } from '../core/import.js';
import { init } from '../core/init.js';
import { list } from '../core/list.js';
import { storageRoot } from '../core/paths.js';
import { prune } from '../core/prune.js';
import { save } from '../core/save.js';
import { show } from '../core/show.js';
import { parseCsv } from '../core/validate.js';
import { exitCodeFor, formatErrorHuman, formatErrorJson, toErrorShape } from '../output/error.js';
import {
  formatFindHuman,
  formatFindJson,
  formatListHuman,
  formatListJson,
  formatSaveHuman,
  formatSaveJson,
  formatShowHuman,
  formatShowJson,
} from '../output/format.js';
import { HELP_TEXT } from './help.js';
import { readStdin } from './io.js';
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

export async function run(argv: string[] = process.argv.slice(2)): Promise<void> {
  const { rest, flags } = parseGlobalFlags(argv);

  // Short-circuit help/version BEFORE auto-prune so they stay snappy and don't
  // touch the filesystem at all (per spec).
  if (rest.length === 0 || rest.includes('--help') || rest.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }
  if (rest.includes('--version') || rest.includes('-v')) {
    console.log(getVersion());
    return;
  }

  const [command, ...args] = rest;
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
      case 'show':
        await cmdShow(cwd, args, flags);
        return;
      case 'prune':
        await cmdPrune(cwd, args, flags);
        return;
      case 'import':
        await cmdImport(cwd, args, flags);
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
  if (sort && !['updated', 'created', 'name'].includes(sort)) {
    throw new CarnetError('validation_error', `invalid --sort "${sort}"`, 'one of: updated, created, name');
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
    sort: sort as 'updated' | 'created' | 'name' | undefined,
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

async function cmdShow(cwd: string, args: string[], flags: RunFlags): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      'no-touch': { type: 'boolean' },
      'no-frontmatter': { type: 'boolean' },
    },
  });
  const path = parsed.positionals[0];
  if (!path) throw new CarnetError('validation_error', 'show <path> is required');
  const v = parsed.values;
  const carnet = await show(cwd, path, { noTouch: v['no-touch'] as boolean | undefined });
  if (flags.json) console.log(formatShowJson(carnet));
  else console.log(formatShowHuman(carnet, !v['no-frontmatter']));
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
  // `--interactive` is acknowledged in Phase 1 but defers to bulk move; we keep
  // the flag wired so scripts that pass it don't break, and document that the
  // prompts will land in a follow-up phase.
  const report = await prune(cwd, readConfig(), {
    dryRun: v['dry-run'] as boolean | undefined,
    includeTrash: v['include-trash'] as boolean | undefined,
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

async function cmdImport(cwd: string, args: string[], flags: RunFlags): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: { 'dry-run': { type: 'boolean' } },
  });
  const src = parsed.positionals[0] ?? 'memories';
  const report = await importFrom(cwd, src, { dryRun: parsed.values['dry-run'] as boolean | undefined });
  if (flags.json) {
    console.log(JSON.stringify({ ok: true, ...report, destination: storageRoot(cwd) }, null, 2));
  } else {
    console.log(`imported: ${report.imported.length} (from ${resolve(cwd, src)} to ${storageRoot(cwd)})`);
    for (const p of report.imported) console.log(`  + ${p}`);
    if (report.skipped.length > 0) {
      console.log(`skipped: ${report.skipped.length}`);
      for (const p of report.skipped) console.log(`  - ${p}`);
    }
  }
}

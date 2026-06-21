import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import matter from 'gray-matter';
import type { Carnet, CarnetFrontmatter } from '../types/index.js';
import { parseDate, today } from './dates.js';
import { CarnetError } from './errors.js';
import { storageRoot, TRASH_DIR_NAME, trashRoot } from './paths.js';

/** Walk a directory recursively, returning all `*.md` paths relative to `root`. */
export async function walkMarkdown(root: string): Promise<string[]> {
  if (!existsSync(root)) return [];
  const out: string[] = [];

  async function visit(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        await visit(full);
      } else if (e.isFile() && e.name.endsWith('.md')) {
        out.push(full);
      }
    }
  }

  await visit(root);
  return out.map((p) => relative(root, p).split(sep).join('/'));
}

export async function ensureDir(p: string): Promise<void> {
  await mkdir(p, { recursive: true });
}

export async function readCarnet(absPath: string, relPath: string): Promise<Carnet> {
  let raw: string;
  try {
    raw = await readFile(absPath, 'utf-8');
  } catch {
    throw new CarnetError('not_found', `carnet not found: ${relPath}`);
  }
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (e) {
    throw new CarnetError(
      'frontmatter_error',
      `failed to parse frontmatter: ${relPath}`,
      e instanceof Error ? e.message : undefined,
    );
  }
  // gray-matter v4 has an internal LRU cache keyed by file content. Two reads
  // of the same content return the SAME object, and mutating it (as `show` /
  // `save` legitimately do) leaks across calls. Always work on a shallow copy.
  const fm = { ...(parsed.data as Record<string, unknown>) };
  // gray-matter parses unquoted YAML dates (e.g. `2026-05-04`) into Date
  // objects. Carnets store dates as plain ISO strings everywhere else, so
  // normalize back to YYYY-MM-DD here. Otherwise downstream comparisons
  // (`fm.updated !== today()`) and JSON serialization both surprise the user.
  for (const key of ['created', 'updated', 'last_used'] as const) {
    const v = fm[key];
    if (v instanceof Date) {
      fm[key] =
        `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
    }
  }
  return {
    relPath,
    absPath,
    frontmatter: fm as CarnetFrontmatter,
    body: parsed.content,
  };
}

export async function writeCarnet(absPath: string, frontmatter: CarnetFrontmatter, body: string): Promise<void> {
  await ensureDir(dirname(absPath));
  // Strip undefined keys so they don't show up as `key: undefined` in YAML.
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(frontmatter)) {
    if (v !== undefined) cleaned[k] = v;
  }
  const serialized = matter.stringify(body.endsWith('\n') ? body : `${body}\n`, cleaned);
  await writeFile(absPath, serialized, 'utf-8');
}

/** Load every carnet under the storage root (excluding `.trash/`). */
export async function loadAllCarnets(cwd: string = process.cwd()): Promise<Carnet[]> {
  const root = storageRoot(cwd);
  const rels = (await walkMarkdown(root)).filter((p) => !p.startsWith(`${TRASH_DIR_NAME}/`));
  const carnets: Carnet[] = [];
  for (const rel of rels) {
    try {
      carnets.push(await readCarnet(join(root, rel), rel));
    } catch (e) {
      // Surface frontmatter errors but keep going so one corrupt file doesn't
      // block list / find / prune from completing.
      if (e instanceof CarnetError && e.code === 'frontmatter_error') continue;
      throw e;
    }
  }
  return carnets;
}

/** Move a carnet from the live tree into `.trash/`, preserving its sub-path. */
export async function moveToTrash(cwd: string, relPath: string, now: Date = new Date()): Promise<string> {
  const src = resolve(storageRoot(cwd), relPath);
  const dest = resolve(trashRoot(cwd), relPath);
  await ensureDir(dirname(dest));
  await rename(src, dest);
  // Stamp the arrival time so the trash TTL counts from when the carnet landed
  // here, not from its last edit. An expired carnet is already >= lifespan
  // stale, so an mtime-based TTL would hard-delete it the instant it arrives,
  // skipping the recovery window entirely.
  try {
    const c = await readCarnet(dest, relPath);
    c.frontmatter.trashed_at = today(now);
    await writeCarnet(dest, c.frontmatter, c.body);
  } catch {
    // Corrupt frontmatter can't be stamped; touch the mtime instead so the
    // sweep still measures the TTL from arrival rather than the old edit time.
    await utimes(dest, now, now);
  }
  return dest;
}

export async function fileMtime(absPath: string): Promise<Date> {
  const s = await stat(absPath);
  return s.mtime;
}

/**
 * When a trashed carnet entered `.trash/`. Prefers the `trashed_at` stamp;
 * falls back to the file mtime for carnets trashed before stamping existed (or
 * whose frontmatter can't be parsed).
 */
export async function trashEntryTime(absPath: string, relPath: string): Promise<Date> {
  try {
    const c = await readCarnet(absPath, relPath);
    const t = c.frontmatter.trashed_at;
    if (typeof t === 'string') return parseDate(t);
  } catch {
    // Unparseable frontmatter or a malformed trashed_at: fall back to mtime.
  }
  return fileMtime(absPath);
}

export async function hardDelete(absPath: string): Promise<void> {
  await rm(absPath, { force: true });
}

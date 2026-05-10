import { resolve } from 'node:path';
import { today } from './dates.js';
import { normalizeCarnetPath, storageRoot } from './paths.js';
import { readCarnet, writeCarnet } from './storage.js';

export interface UsedResult {
  relPath: string;
  absPath: string;
  lastUsed: string;
  useCount: number;
}

/**
 * Mark a carnet as **explicitly used** without reading its body. Bumps
 * `last_used` to today and increments `use_count` by one. The body is not
 * loaded into the caller's view, which makes this the cheapest way to record
 * "this note was applied" inside an agent loop.
 *
 * Distinct from `show`: `show` is a weak use signal (the body was read), this
 * is the strong signal that the note actually mattered to the work — so this
 * always writes (no `changed: false` short-circuit), since the count must
 * advance even when `last_used` is already today.
 */
export async function used(cwd: string, path: string, now: Date = new Date()): Promise<UsedResult> {
  const relPath = normalizeCarnetPath(path);
  const absPath = resolve(storageRoot(cwd), relPath);
  const carnet = await readCarnet(absPath, relPath);
  const dateStr = today(now);

  const prevCount =
    typeof carnet.frontmatter.use_count === 'number' && Number.isFinite(carnet.frontmatter.use_count)
      ? carnet.frontmatter.use_count
      : 0;
  const nextCount = prevCount + 1;

  carnet.frontmatter.last_used = dateStr;
  carnet.frontmatter.use_count = nextCount;
  await writeCarnet(absPath, carnet.frontmatter, carnet.body);

  return { relPath, absPath, lastUsed: dateStr, useCount: nextCount };
}

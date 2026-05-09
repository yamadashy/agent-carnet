import { resolve } from 'node:path';
import { today } from './dates.js';
import { normalizeCarnetPath, storageRoot } from './paths.js';
import { readCarnet, writeCarnet } from './storage.js';

export interface TouchResult {
  relPath: string;
  absPath: string;
  updated: string;
  changed: boolean;
}

/**
 * Bump `updated` to today without reading the body. Distinct from `show` which
 * also reads + emits the body. If `updated` is already today we skip the write
 * to avoid disturbing mtime / git diffs for a no-op.
 */
export async function touch(cwd: string, path: string, now: Date = new Date()): Promise<TouchResult> {
  const relPath = normalizeCarnetPath(path);
  const absPath = resolve(storageRoot(cwd), relPath);
  const carnet = await readCarnet(absPath, relPath);
  const dateStr = today(now);
  if (carnet.frontmatter.updated === dateStr) {
    return { relPath, absPath, updated: dateStr, changed: false };
  }
  carnet.frontmatter.updated = dateStr;
  await writeCarnet(absPath, carnet.frontmatter, carnet.body);
  return { relPath, absPath, updated: dateStr, changed: true };
}

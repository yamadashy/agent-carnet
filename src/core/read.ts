import { resolve } from 'node:path';
import type { Carnet } from '../types/index.js';
import { today } from './dates.js';
import { normalizeCarnetPath, storageRoot } from './paths.js';
import { readCarnet, writeCarnet } from './storage.js';

export interface ReadOptions {
  noTouch?: boolean;
}

/**
 * Load and (by default) refresh-on-use: bumps `last_used` on disk so lifespan
 * resets. Reading a carnet is a weak use signal — the agent bothered to pull
 * the body into context, but did not explicitly mark the note as applied
 * (see `used`). Pass `noTouch: true` to look without leaving fingerprints.
 *
 * Note: `updated` is not touched here — it tracks content modification, not
 * usage. `use_count` is also not incremented (only the explicit `used`
 * command does that).
 */
export async function read(
  cwd: string,
  path: string,
  options: ReadOptions = {},
  now: Date = new Date(),
): Promise<Carnet> {
  const relPath = normalizeCarnetPath(path);
  const absPath = resolve(storageRoot(cwd), relPath);
  const carnet = await readCarnet(absPath, relPath);

  if (!options.noTouch) {
    const dateStr = today(now);
    if (carnet.frontmatter.last_used !== dateStr) {
      carnet.frontmatter.last_used = dateStr;
      await writeCarnet(absPath, carnet.frontmatter, carnet.body);
    }
  }

  return carnet;
}

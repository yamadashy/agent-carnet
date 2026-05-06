import { resolve } from 'node:path';
import type { Carnet } from '../types/index.js';
import { today } from './dates.js';
import { normalizeCarnetPath, storageRoot } from './paths.js';
import { readCarnet, writeCarnet } from './storage.js';

export interface ShowOptions {
  noTouch?: boolean;
}

/**
 * Load and (by default) refresh-on-use: bumps the `updated` field on disk so
 * lifespan resets. Pass `noTouch: true` to look without leaving fingerprints.
 */
export async function show(
  cwd: string,
  path: string,
  options: ShowOptions = {},
  now: Date = new Date(),
): Promise<Carnet> {
  const relPath = normalizeCarnetPath(path);
  const absPath = resolve(storageRoot(cwd), relPath);
  const carnet = await readCarnet(absPath, relPath);

  if (!options.noTouch) {
    const dateStr = today(now);
    if (carnet.frontmatter.updated !== dateStr) {
      carnet.frontmatter.updated = dateStr;
      await writeCarnet(absPath, carnet.frontmatter, carnet.body);
    }
  }

  return carnet;
}

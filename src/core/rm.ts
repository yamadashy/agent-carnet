import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CarnetError } from './errors.js';
import { normalizeCarnetPath, storageRoot } from './paths.js';
import { hardDelete, moveToTrash } from './storage.js';

export interface RemoveOptions {
  /** Skip the soft-delete safety net and unlink immediately. */
  hard?: boolean;
}

export interface RemoveResult {
  relPath: string;
  absPath: string;
  trashed: boolean;
}

/**
 * Delete a single carnet. By default we mirror `prune` and move the file to
 * `.trash/`; `hard: true` unlinks straight away.
 */
export async function remove(cwd: string, path: string, options: RemoveOptions = {}): Promise<RemoveResult> {
  const relPath = normalizeCarnetPath(path);
  const absPath = resolve(storageRoot(cwd), relPath);
  if (!existsSync(absPath)) {
    throw new CarnetError('not_found', `carnet not found: ${relPath}`);
  }
  if (options.hard) {
    await hardDelete(absPath);
    return { relPath, absPath, trashed: false };
  }
  await moveToTrash(cwd, relPath);
  return { relPath, absPath, trashed: true };
}

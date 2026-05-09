import { existsSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { CarnetError } from './errors.js';
import { normalizeCarnetPath, slugOf, storageRoot } from './paths.js';
import { ensureDir } from './storage.js';

export interface MoveOptions {
  /** Allow overwriting an existing destination. */
  update?: boolean;
}

export interface MoveResult {
  fromRel: string;
  toRel: string;
  fromAbs: string;
  toAbs: string;
}

/**
 * Move a carnet between categories. The destination may be either a full
 * `<category>/<slug>` or a trailing-slash form (`<category>/`) which keeps the
 * source filename. Frontmatter is preserved verbatim — we deliberately do NOT
 * bump `updated` because reorganization isn't "use".
 */
export async function move(
  cwd: string,
  fromInput: string,
  toInput: string,
  options: MoveOptions = {},
): Promise<MoveResult> {
  const fromRel = normalizeCarnetPath(fromInput);
  const fromAbs = resolve(storageRoot(cwd), fromRel);
  if (!existsSync(fromAbs)) {
    throw new CarnetError('not_found', `carnet not found: ${fromRel}`);
  }

  // `to` ending in `/` means "drop into this category, keep source filename".
  // Detect before normalization since normalizeCarnetPath rejects paths with
  // fewer than two segments.
  const looksLikeDir = /[/\\]\s*$/.test(toInput);
  const toRel = looksLikeDir
    ? normalizeCarnetPath(`${toInput.replace(/[/\\]+\s*$/, '')}/${slugOf(fromRel)}`)
    : normalizeCarnetPath(toInput);
  const toAbs = resolve(storageRoot(cwd), toRel);

  if (fromAbs === toAbs) {
    throw new CarnetError('validation_error', `move source and destination are the same: ${fromRel}`);
  }
  if (existsSync(toAbs) && !options.update) {
    throw new CarnetError('conflict', `destination already exists: ${toRel}`, 'pass --update to overwrite');
  }

  await ensureDir(dirname(toAbs));
  await rename(fromAbs, toAbs);

  return { fromRel, toRel, fromAbs, toAbs };
}

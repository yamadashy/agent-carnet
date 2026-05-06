import { resolve } from 'node:path';
import { CarnetError } from './errors.js';

export const STORAGE_DIR_NAME = '.agent-carnet';
export const TRASH_DIR_NAME = '.trash';

export function storageRoot(cwd: string = process.cwd()): string {
  return resolve(cwd, STORAGE_DIR_NAME);
}

export function trashRoot(cwd: string = process.cwd()): string {
  return resolve(storageRoot(cwd), TRASH_DIR_NAME);
}

// Characters disallowed inside a single carnet path segment. Includes NUL
// (POSIX path terminator) and the Windows-reserved set. Built at runtime so
// the regex literal stays free of control characters and passes lint.
const FORBIDDEN_PATH_CHARS = new RegExp(`[${String.fromCharCode(0)}<>:"|?*]`);

/**
 * Validate and normalize a user-supplied carnet path of the form
 * `<category>/<slug>` (with optional `.md`). Rejects path traversal, absolute
 * paths, leading slashes, and empty segments — agents can ask for arbitrary
 * input and we don't want any of it escaping the storage root.
 *
 * Returns the relative path with `.md` appended.
 */
export function normalizeCarnetPath(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new CarnetError('validation_error', 'carnet path is required', 'pass <category>/<slug>');
  }
  // Reject Windows-style backslashes too — we keep paths POSIX-y on disk.
  const normalized = input.replace(/\\/g, '/').trim();

  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    throw new CarnetError('validation_error', `absolute paths are not allowed: ${input}`);
  }
  const segments = normalized.split('/').filter((s) => s.length > 0);
  if (segments.length < 2) {
    throw new CarnetError(
      'validation_error',
      `carnet path must be <category>/<slug>: got "${input}"`,
      'example: dependencies/iconv-issue',
    );
  }
  for (const seg of segments) {
    if (seg === '.' || seg === '..') {
      throw new CarnetError('validation_error', `path traversal is not allowed: ${input}`);
    }
    if (FORBIDDEN_PATH_CHARS.test(seg)) {
      throw new CarnetError('validation_error', `invalid character in path: ${input}`);
    }
  }
  const last = segments[segments.length - 1];
  segments[segments.length - 1] = last.endsWith('.md') ? last : `${last}.md`;
  return segments.join('/');
}

/** Strip the trailing `.md` and return the leading category portion. */
export function categoryOf(relPath: string): string {
  const parts = relPath.split('/');
  return parts.slice(0, -1).join('/');
}

/** Strip the trailing `.md` and return the slug. */
export function slugOf(relPath: string): string {
  const parts = relPath.split('/');
  return parts[parts.length - 1].replace(/\.md$/, '');
}

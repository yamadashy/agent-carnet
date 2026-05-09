import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, rm, rmdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CarnetError } from './errors.js';

/**
 * Subdirectory name used inside a Claude Code skills directory. The same name
 * is used both globally (`~/.claude/skills/agent-carnet/`) and per-project
 * (`<cwd>/.claude/skills/agent-carnet/`).
 */
export const SKILL_DIR_NAME = 'agent-carnet';

/** Filename of the bundled skill definition. */
export const SKILL_FILE_NAME = 'SKILL.md';

export interface SkillTargetOptions {
  /** When true, install into `<cwd>/.claude/skills/...` instead of `$HOME/.claude/...`. */
  here?: boolean;
  /** Override `process.cwd()` (used by tests). */
  cwd?: string;
  /** Override `os.homedir()` (used by tests). */
  home?: string;
}

export interface SkillInstallOptions extends SkillTargetOptions {
  /** Overwrite an existing SKILL.md if present. */
  force?: boolean;
  /**
   * Override the bundled SKILL.md source path. Used by tests; the CLI relies
   * on the default lookup against `import.meta.url`.
   */
  source?: string;
}

export interface SkillInstallResult {
  /** Absolute path the SKILL.md was written to. */
  path: string;
  /** True when an existing file was overwritten via `--force`. */
  overwritten: boolean;
}

export interface SkillUninstallResult {
  /** Absolute path that was targeted (whether or not it existed). */
  path: string;
  /** True when a file was actually removed. False when nothing was there. */
  removed: boolean;
}

/**
 * Resolve the absolute target path for `agent-carnet skill (install|uninstall|path)`.
 *
 * The `--here` form picks `<cwd>/.claude/skills/agent-carnet/SKILL.md`. Without
 * `--here`, the target is the user's global Claude Code skills folder under
 * `$HOME/.claude/skills/agent-carnet/SKILL.md`.
 */
export function resolveSkillTarget(options: SkillTargetOptions = {}): string {
  const base = options.here
    ? join(options.cwd ?? process.cwd(), '.claude', 'skills', SKILL_DIR_NAME)
    : join(options.home ?? homedir(), '.claude', 'skills', SKILL_DIR_NAME);
  return join(base, SKILL_FILE_NAME);
}

/**
 * Locate the bundled `SKILL.md` shipped alongside the CLI.
 *
 * The published tarball lays out `dist/bin/agent-carnet.mjs` and a sibling
 * `skills/agent-carnet/SKILL.md`, so we anchor on this module's own file URL
 * and walk up to the package root. The first candidate that exists wins; the
 * second handles local-dev runs where the CLI executes from `src/` (via tsx).
 */
export function locateBundledSkill(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Built layout: dist/<chunk>.mjs or dist/bin/agent-carnet.mjs → ../skills/...
    resolve(here, '..', 'skills', SKILL_DIR_NAME, SKILL_FILE_NAME),
    // Built layout one level deeper: dist/bin/*.mjs → ../../skills/...
    resolve(here, '..', '..', 'skills', SKILL_DIR_NAME, SKILL_FILE_NAME),
    // tsx / source-run layout: src/core/skill.ts → ../../skills/...
    resolve(here, '..', '..', 'skills', SKILL_DIR_NAME, SKILL_FILE_NAME),
    // Fallback for any caller that runs the CLI from the package root.
    resolve(process.cwd(), 'skills', SKILL_DIR_NAME, SKILL_FILE_NAME),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new CarnetError(
    'internal_error',
    `bundled SKILL.md not found (searched: ${candidates.join(', ')})`,
    'reinstall agent-carnet — the package may be corrupted',
  );
}

/**
 * Copy the bundled SKILL.md into the target Claude Code skills directory.
 *
 * Refuses to clobber an existing file unless `force` is set; that surfaces as
 * a `conflict` error and exit code 4 at the CLI boundary.
 */
export async function installSkill(options: SkillInstallOptions = {}): Promise<SkillInstallResult> {
  const target = resolveSkillTarget(options);
  const source = options.source ?? locateBundledSkill();
  const exists = existsSync(target);
  if (exists && !options.force) {
    throw new CarnetError(
      'conflict',
      `SKILL.md already exists at ${target}`,
      'pass --force to overwrite the existing file',
    );
  }
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  return { path: target, overwritten: exists };
}

/**
 * Remove the installed SKILL.md and the `agent-carnet/` parent dir if empty.
 *
 * Idempotent: a missing file is treated as a no-op (no error). The parent dir
 * is only removed when empty so a co-installed skill (e.g. user-edited files)
 * is never collateral damage.
 */
export async function uninstallSkill(options: SkillTargetOptions = {}): Promise<SkillUninstallResult> {
  const target = resolveSkillTarget(options);
  if (!existsSync(target)) {
    return { path: target, removed: false };
  }
  await rm(target, { force: true });
  // Best-effort cleanup of the parent agent-carnet/ dir when nothing else lives there.
  const parent = dirname(target);
  try {
    const entries = await readdir(parent);
    if (entries.length === 0) {
      await rmdir(parent);
    }
  } catch {
    // Parent dir may have already vanished (race with a manual rm). Not fatal.
  }
  return { path: target, removed: true };
}

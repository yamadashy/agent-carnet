import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, rm, rmdir } from 'node:fs/promises';
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

/** Filename of the bundled skill definition (the anchor file inside the dir). */
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
   * Override the bundled skill source directory. Used by tests; the CLI relies
   * on the default lookup against `import.meta.url`.
   */
  source?: string;
}

export interface SkillInstallResult {
  /** Absolute path of the installed SKILL.md (the canonical anchor file). */
  path: string;
  /** Absolute path of the installed skill directory (parent of SKILL.md). */
  dir: string;
  /** True when an existing SKILL.md was overwritten via `--force`. */
  overwritten: boolean;
}

export interface SkillUninstallResult {
  /** Absolute path that was targeted for the SKILL.md (whether or not it existed). */
  path: string;
  /** Absolute path of the skill directory (whether or not it existed). */
  dir: string;
  /** True when a file was actually removed. False when nothing was there. */
  removed: boolean;
}

/**
 * Resolve the absolute target *directory* for `agent-carnet skill`. This is the
 * folder that holds SKILL.md plus the bundled `references/` subtree.
 *
 * The `--here` form picks `<cwd>/.claude/skills/agent-carnet/`. Without
 * `--here`, the target is the user's global Claude Code skills folder under
 * `$HOME/.claude/skills/agent-carnet/`.
 */
export function resolveSkillDir(options: SkillTargetOptions = {}): string {
  return options.here
    ? join(options.cwd ?? process.cwd(), '.claude', 'skills', SKILL_DIR_NAME)
    : join(options.home ?? homedir(), '.claude', 'skills', SKILL_DIR_NAME);
}

/** Resolve the absolute target *file* path for SKILL.md inside the skill dir. */
export function resolveSkillTarget(options: SkillTargetOptions = {}): string {
  return join(resolveSkillDir(options), SKILL_FILE_NAME);
}

/**
 * Locate the bundled skill *directory* shipped alongside the CLI.
 *
 * The published tarball lays out `dist/bin/agent-carnet.mjs` and a sibling
 * `skills/agent-carnet/` (containing SKILL.md plus references/), so we anchor
 * on this module's own file URL and walk up to the package root. The first
 * candidate that contains a SKILL.md wins.
 */
export function locateBundledSkillDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Built layout: dist/<chunk>.mjs → ../skills/agent-carnet/
    resolve(here, '..', 'skills', SKILL_DIR_NAME),
    // Built layout one level deeper: dist/bin/*.mjs → ../../skills/agent-carnet/
    resolve(here, '..', '..', 'skills', SKILL_DIR_NAME),
    // Fallback for any caller that runs the CLI from the package root.
    resolve(process.cwd(), 'skills', SKILL_DIR_NAME),
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, SKILL_FILE_NAME))) return candidate;
  }
  throw new CarnetError(
    'internal_error',
    `bundled skill directory not found (searched: ${candidates.join(', ')})`,
    'reinstall agent-carnet — the package may be corrupted',
  );
}

/**
 * Copy the bundled skill directory (SKILL.md + references/) into the target
 * Claude Code skills directory.
 *
 * Refuses to clobber an existing SKILL.md unless `force` is set; that surfaces
 * as a `conflict` error and exit code 4 at the CLI boundary. With `force`, the
 * entire target directory is replaced.
 */
export async function installSkill(options: SkillInstallOptions = {}): Promise<SkillInstallResult> {
  const dir = resolveSkillDir(options);
  const target = join(dir, SKILL_FILE_NAME);
  const sourceDir = options.source ?? locateBundledSkillDir();
  const exists = existsSync(target);
  if (exists && !options.force) {
    throw new CarnetError(
      'conflict',
      `SKILL.md already exists at ${target}`,
      'pass --force to overwrite the existing skill files',
    );
  }
  await mkdir(dirname(dir), { recursive: true });
  // Recursive copy: ships SKILL.md plus everything under references/.
  // `force: true` lets --force overwrite individual files inside the target.
  await cp(sourceDir, dir, { recursive: true, force: true });
  return { path: target, dir, overwritten: exists };
}

/**
 * Remove the installed skill directory and the parent skills/ dir if empty.
 *
 * Idempotent: a missing SKILL.md is treated as a no-op (no error). The whole
 * `agent-carnet/` subtree is removed (SKILL.md + references/ + anything else
 * inside) — anyone who edited those files in place loses the edits, which is
 * the right tradeoff for an explicit `uninstall`. The grandparent `skills/`
 * dir is only removed when it has no other skills in it.
 */
export async function uninstallSkill(options: SkillTargetOptions = {}): Promise<SkillUninstallResult> {
  const dir = resolveSkillDir(options);
  const target = join(dir, SKILL_FILE_NAME);
  if (!existsSync(target)) {
    return { path: target, dir, removed: false };
  }
  await rm(dir, { recursive: true, force: true });
  // Best-effort cleanup of the parent `skills/` dir when nothing else lives there.
  const parent = dirname(dir);
  try {
    const entries = await readdir(parent);
    if (entries.length === 0) {
      await rmdir(parent);
    }
  } catch {
    // Parent dir may have already vanished (race with a manual rm). Not fatal.
  }
  return { path: target, dir, removed: true };
}

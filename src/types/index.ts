/**
 * Shared type definitions for agent-carnet.
 *
 * The "carnet" model: each carnet is one markdown file with YAML frontmatter
 * stored under `<cwd>/.agent-carnet/<category>/<slug>.md`. Lifespan is per
 * carnet (default 30d) and refreshes on read.
 */

/** YAML frontmatter persisted on disk. Mirrors the on-disk shape one-for-one. */
export interface CarnetFrontmatter {
  /** One-line description. Required. */
  summary: string;
  /** Writer identity (`claude-code`, `codex`, `cursor`, `human`, ...). Required. */
  agent: string;
  /** ISO date (YYYY-MM-DD). CLI-managed. */
  created: string;
  /** ISO date (YYYY-MM-DD). CLI-managed; bumped by `show` and `touch`. */
  updated: string;
  /** Free-form labels. */
  tags?: string[];
  /** File paths or other carnet paths this entry points at. */
  related?: string[];
  /** Per-carnet lifespan override, e.g. `90d`, `1y`, `never`. */
  lifespan?: string;
  /** Pin against auto-prune. */
  keep?: boolean;
  /** Allow extra user-supplied keys. */
  [key: string]: unknown;
}

/** A loaded carnet — frontmatter + body + on-disk path. */
export interface Carnet {
  /** Path relative to `.agent-carnet/`, including `.md` (e.g. `dependencies/iconv-issue.md`). */
  relPath: string;
  /** Absolute filesystem path. */
  absPath: string;
  frontmatter: CarnetFrontmatter;
  body: string;
}

/** Structured CLI error. Maps 1:1 to the JSON error envelope. */
export interface CliErrorShape {
  code: ErrorCode;
  message: string;
  hint?: string;
}

export type ErrorCode = 'validation_error' | 'not_found' | 'conflict' | 'frontmatter_error' | 'internal_error';

export type OutputMode = 'human' | 'json';

export interface GlobalFlags {
  json: boolean;
  noColor: boolean;
  noAutoPrune: boolean;
  quiet: boolean;
}

export interface PruneReport {
  movedToTrash: string[];
  hardDeleted: string[];
}

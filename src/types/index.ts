/**
 * Shared type definitions for agent-carnet.
 *
 * The "carnet" model: each carnet is one markdown file with YAML frontmatter
 * stored under `<cwd>/.carnet/<category>/<slug>.md`. Lifespan is per
 * carnet (default 30d) and refreshes on read.
 */

/** YAML frontmatter persisted on disk. Mirrors the on-disk shape one-for-one. */
export interface CarnetFrontmatter {
  /** One-line description. Required. */
  summary: string;
  /** Writer identity (`claude-code`, `codex`, `cursor`, `human`, ...). Required. */
  agent: string;
  /** ISO date (YYYY-MM-DD). Set once on first save, never modified afterwards. */
  created: string;
  /** ISO date (YYYY-MM-DD). Bumped only when the body or frontmatter is modified
   *  (`save`, `save --update`). Independent of usage. */
  updated: string;
  /** ISO date (YYYY-MM-DD). Bumped on `save`, `show` (read), and `used` (apply).
   *  This is the field that drives expiry: `expiry = last_used + lifespan`. */
  last_used?: string;
  /** Number of times the carnet has been explicitly marked as used via the
   *  `used` command. A reference signal of importance — higher counts indicate
   *  the carnet is repeatedly worth applying. Not bumped by `show` (read alone). */
  use_count?: number;
  /** Free-form labels. */
  tags?: string[];
  /** File paths or other carnet paths this entry points at. */
  related?: string[];
  /** Per-carnet lifespan override, e.g. `90d`, `1y`, `never`. */
  lifespan?: string;
  /** Pin against auto-prune. */
  keep?: boolean;
  /** ISO date (YYYY-MM-DD). Stamped when the carnet is moved into `.trash/`.
   *  Drives the trash TTL (`hard-delete = trashed_at + trashTtl`) so the
   *  recovery window counts from arrival, not from the carnet's last edit.
   *  Normally only present on files under `.trash/`. */
  trashed_at?: string;
  /** Allow extra user-supplied keys. */
  [key: string]: unknown;
}

/** A loaded carnet — frontmatter + body + on-disk path. */
export interface Carnet {
  /** Path relative to `.carnet/`, including `.md` (e.g. `dependencies/iconv-issue.md`). */
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

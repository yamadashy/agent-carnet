# Changelog

All notable changes to `agent-carnet` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - 2026-05-10

### Changed (breaking)

- Lifespan model split into separate **modification** and **usage**
  signals. Previously a single `updated` field was bumped by every
  read, write, and touch and drove auto-prune. The model now tracks
  four CLI-managed fields independently:
  - `created` — birth date, immutable after first save.
  - `updated` — last content modification (`save`, `save --update`).
    No longer bumped by reads.
  - `last_used` — last interaction (`save`, `show`, `used`). **This
    is now what drives expiry**: `expiry = last_used + lifespan`.
  - `use_count` — incremented only by the new `used` command.
    A reference importance signal that downstream tooling and
    `agent-carnet list --sort use_count` can read.
  Reading a carnet (`show`) still keeps it alive (weak use signal,
  bumps `last_used`) but no longer increments `use_count`. Existing
  carnets without `last_used` fall back to `updated` for expiry,
  so already-saved notes keep working without migration.
- `touch` command renamed to `used`. Same purpose (refresh without
  reading the body) but the new name says *why* you would call it
  and the implementation also increments `use_count` so the call
  records as a strong importance signal. The old `touch` command is
  removed (no alias) — nobody else is using this CLI yet.
- `list --sort` gains `last_used` (now the default), `use_count`.
  The default sort changed from `updated` to `last_used` so the
  list reflects "most recently used" rather than "most recently
  edited", which is what an agent / human typically wants when
  scanning a notebook.

### Added

- `agent-carnet used <path>` — strong use signal command. Bumps
  `last_used` to today and increments `use_count` by one without
  reading the body. Cheap to call inside an agent loop after a
  carnet actually shaped the work (fix applied, hypothesis cited,
  vocabulary entry reused).
- `agent-carnet list --sort use_count` — sort by importance.
  Combine with `--recent N` to surface the top-N load-bearing notes.
- Per-subcommand help. `agent-carnet <command> -h` (or `--help`) now
  prints a focused help block for that command — required arguments,
  all options, notes, and examples — instead of falling back to the
  global help. The global help references the new pattern, and the
  bundled skill documents it so agents can self-discover flag sets
  without scraping README. Auto-prune is still skipped for any help
  invocation, so subcommand help stays a pure print with no filesystem
  side effects.

### Documentation

- Adopt the butler-hat leather notebook icon as the project mark
  (`docs/logo.svg`, surfaced in the README header and shipped in the
  npm tarball so it renders on npmjs.com too).
- README rewritten: brand name "Agent Carnet" used in prose
  (lowercase `agent-carnet` reserved for the package / command),
  intro slimmed to a single sentence, "Why" section rewritten in
  contrast form (vs vector-DB-backed agent memory and vs ever-
  growing note stores), repomix-style emoji prefixes on top-level
  sections, and the four reference sections (commands, frontmatter
  schema, storage layout, configuration) consolidated under one
  `## 📖 Reference` heading so the conceptual material (Lifespan,
  Cookbook) gets visual priority.
- Lifespan section gains two mermaid diagrams: a state diagram of
  the carnet lifecycle (Live ⇌ Trash, with a self-loop labelled
  with the use commands and the expiry trigger) and a flowchart
  comparing the weak vs strong use signals. Diagrams are tuned to
  fit alongside GitHub's in-page mermaid pan / zoom / copy controls
  without clipping.

## [0.1.2] - 2026-05-10

### Added

- Bundled skill at `skills/agent-carnet/` shipped in the npm tarball
  (`files: ["dist/", "skills/", ...]`) — `SKILL.md` plus
  `references/cookbook.md` and `references/frontmatter.md`. SKILL.md
  covers the daily save / find / show flow on its own and instructs the
  agent to read references/ only when a specific case applies (adopting
  a cookbook pattern, writing into the `meta:` namespace, working with
  non-trivial `lifespan`/`keep`). Install via the open agent-skills
  installer: `npx skills add yamadashy/agent-carnet`.

### Removed

- `skill install` / `skill uninstall` / `skill path` subcommands and
  the in-tree `core/skill.ts` that backed them. Skill installation is
  now delegated to [`npx skills`](https://github.com/vercel-labs/skills),
  the open multi-agent installer. The bundled skill files stay in the
  package for `npx skills` to pick up; only the CLI's own copy logic
  goes away.

### Removed

- `import` subcommand. It had a single hard-coded source format that very
  few users ever needed; nothing else in the CLI assumes its existence.
  Migrating an arbitrary markdown notes folder is a one-shot script the
  user can write in seconds against the documented frontmatter schema.

## [0.1.1] - 2026-05-09

### Added

- `touch <category>/<slug>` — bump `updated` to today without reading the body.
  Cheaper than `show` when an agent only wants to keep a carnet alive.
- `move <from> <to>` — relocate a carnet between categories. Accepts a full
  destination path or a trailing `/` form that preserves the source filename.
  `--update` allows overwriting an existing destination. Frontmatter is
  preserved verbatim; `updated` is intentionally **not** bumped because
  reorganization is not "use".
- `rm <category>/<slug>` — single-carnet deletion. Soft-deletes to `.trash/` by
  default, prompts for confirmation, supports `--yes` to skip the prompt and
  `--hard` to unlink immediately.
- `prune --interactive` — per-carnet prompt (`y` / `N` / `q`) replacing the
  Phase 1 placeholder. Quitting early keeps remaining carnets in place.
- Internal `confirm` / `confirm3` helpers in `cli/io.ts`. Both default to
  refusing the action when stdin is not a TTY, so CI runs are safe without
  `--yes`.

### Changed

- `prune` core now accepts an `onCandidate` callback so the per-item prompt
  lives in the CLI layer. `core/` remains pure.
- Help text and README updated to document the new commands and remove the
  Phase 1 "known gaps" callout.

## [0.1.0] - 2026-05-08

Initial release.

### Added

- Core commands: `init`, `save`, `list`, `find`, `show`, `prune`, `import`.
- Auto-prune on every CLI invocation (lazy lifespan check + soft delete to
  `.agent-carnet/.trash/`, plus TTL-based hard delete).
- `--json` output for every command and a structured stderr error envelope
  (`code` / `message` / `hint`) with stable exit codes.
- Path-traversal defence on every user-supplied carnet path.
- npm provenance + OIDC publish workflow.

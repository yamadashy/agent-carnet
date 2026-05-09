# Changelog

All notable changes to `agent-carnet` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

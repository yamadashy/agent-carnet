# Changelog

All notable changes to `agent-carnet` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-05-10

### Added

- `skill install` / `skill uninstall` / `skill path` — manage a bundled
  Claude Code `SKILL.md` so the agent learns when to reach for the CLI.
  Defaults to the user's global skills folder
  (`~/.claude/skills/agent-carnet/SKILL.md`); `--here` scopes the install to
  `<cwd>/.claude/skills/agent-carnet/SKILL.md` instead. `install` refuses to
  overwrite an existing file unless `--force` is passed (exit code 4 /
  `conflict`); `uninstall` removes the entire installed skill subtree
  (`SKILL.md` + `references/`) and is idempotent when nothing is there.
- Bundled `skills/agent-carnet/SKILL.md` shipped in the npm tarball
  (`files: ["dist/", "skills/", ...]`). The CLI resolves the bundled file
  relative to its own `import.meta.url` so the same lookup works for both
  `dist/bin/agent-carnet.mjs` and source-mode runs via tsx.
- `skills/agent-carnet/references/cookbook.md` and
  `skills/agent-carnet/references/frontmatter.md` — deeper, opt-in
  reference material the SKILL.md tells the agent to read only when a
  specific case applies (adopting a cookbook pattern, writing into the
  `meta:` namespace, working with non-trivial `lifespan`/`keep`). The
  daily save/find/show flow is fully covered by SKILL.md alone, so the
  references stay out of the always-on context.

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

---
description: Core project guidelines for the agent-carnet codebase. Apply these rules when working on any code, documentation, or configuration files within agent-carnet.
alwaysApply: true
inclusion: always
---

# agent-carnet Project Structure and Overview

## Project Overview

`agent-carnet` is a TypeScript CLI for AI agents and humans to record markdown notes, organized by category, with auto-expiry. Each carnet is one markdown file (`<cwd>/.agent-carnet/<category>/<slug>.md`) with YAML frontmatter. Lifespan defaults to 30 days and refreshes when the file is read.

The product positioning is "leather notebook in your jacket pocket" — not "AI brain". Code, docs, and error messages should keep that tone honest.

## Directory Structure

```
agent-carnet/
├── src/
│   ├── bin/agent-carnet.ts     # Thin CLI entry point (delegates to cli/cli.ts)
│   ├── cli/
│   │   ├── cli.ts              # Argv parsing + per-command dispatch
│   │   ├── help.ts             # Help text
│   │   ├── version.ts          # Reads version from package.json
│   │   └── io.ts               # stdin reader
│   ├── core/                   # Pure-ish business logic (no process.exit, no console.log)
│   │   ├── config.ts           # Env-var driven runtime config
│   │   ├── dates.ts            # Date/lifespan/expiry math
│   │   ├── errors.ts           # CarnetError + exitCodeFor mapping
│   │   ├── find.ts             # Pure-JS keyword search
│   │   ├── import.ts           # agent-memory skill -> .agent-carnet/ migration
│   │   ├── init.ts             # .agent-carnet/ creation + .gitignore patching
│   │   ├── list.ts             # Filtered/sorted listing
│   │   ├── paths.ts            # Path normalization + traversal defence
│   │   ├── prune.ts            # Lifespan + .trash/ TTL sweep
│   │   ├── save.ts             # Create / update single carnet
│   │   ├── show.ts             # Read carnet + bump `updated` (refresh-on-use)
│   │   ├── storage.ts          # Filesystem walk + read/write
│   │   └── validate.ts         # Frontmatter validation + CSV parsing
│   ├── output/
│   │   ├── error.ts            # Human + JSON error envelope
│   │   └── format.ts           # Human + JSON formatters for commands
│   ├── types/index.ts          # Shared types
│   └── index.ts                # Library API (re-export barrel)
├── tests/                      # Mirrors src/ — vitest
├── .github/workflows/          # ci.yml, npm-publish.yml
├── biome.json
├── tsdown.config.ts
├── vitest.config.ts
└── package.json
```

## Architecture Principles

- **bin/ stays thin**: only sets up error handlers and calls `cli/cli.ts`.
- **cli/ does I/O**: argument parsing, stdin, help/version, formatting selection, calling `core/`.
- **core/ is pure-ish logic**: no `process.exit`, no `console.log`. Throws `CarnetError` for known failure modes.
- **output/ formatters are pluggable**: each function takes a typed result and returns a string. Human or JSON.
- **types/ is the shared shape**: anything cross-module lives here.
- **storage scope is `<cwd>/.agent-carnet/`** — Phase 1 has no global scope, no `--scope` flag.
- **ESM only**: `"type": "module"` everywhere.

## Error model

- `CarnetError(code, message, hint?)` thrown from core/.
- Codes map to exit codes per `CLI.md`: `validation_error` / `frontmatter_error` → 2, `not_found` → 3, `conflict` → 4, `internal_error` → 1.
- Human format: `error: <code>\n  message: <msg>\n  hint: <hint>` on stderr.
- JSON format (`--json`): `{ "ok": false, "error": { code, message, hint } }`.

## Auto-prune

Every CLI invocation (except `--help` / `--version`) runs `prune` lazily:

- Walks `.agent-carnet/`, identifies carnets where `updated + lifespan < now`.
- Moves them to `.agent-carnet/.trash/`.
- Hard-deletes anything in `.trash/` older than `AGENT_CARNET_TRASH_TTL` (default 7d).
- Carnets with `keep: true` or `lifespan: never` are exempt.
- Disable per-call with `--no-auto-prune`, or globally with `AGENT_CARNET_AUTO_PRUNE=false`.

## Build and Tooling

- **Build**: `npm run build` (tsdown / rolldown). Outputs `dist/bin/agent-carnet.mjs` (CLI) and `dist/index.mjs` (library).
- **Lint pipeline**: `npm run lint` runs Biome + oxlint + tsgo + secretlint. Each is also exposed individually as `lint-biome`, `lint-oxlint`, `lint-ts`, `lint-secretlint`.
- **Test**: Vitest. `npm run test` (and `test-coverage` for thresholds).
- Coverage thresholds: lines/statements/functions ≥ 85, branches ≥ 80.

## Coding Guidelines

- Idiomatic TypeScript with `"strict": true`.
- Keep dependencies minimal. Phase 1 runtime deps: `gray-matter`, `parse-duration`, `picocolors`.
- If a file exceeds 250 lines, consider splitting.
- Comments only when the **why** is non-obvious. Skip comments that describe what the code already shows.
- New features come with tests.
- All public-facing strings (README, help text, error messages, commit messages) are in **English**.
- Before declaring work done, run:
  ```bash
  npm run lint
  npm run test
  npm run build
  node dist/bin/agent-carnet.mjs --version
  node dist/bin/agent-carnet.mjs --help
  ```

## Phase 1 scope (this codebase)

Implemented: `init`, `save`, `list`, `find`, `show`, `prune`, `import`, plus auto-prune on every invocation, JSON output, structured errors, path-traversal defence, env-var configuration.

Deferred to Phase 2+: `touch`, `move`, `rm`, `init --with-ci`, polished interactive prompts for `prune --interactive`. The architecture leaves room (the `cmd*` switch in `cli/cli.ts`) but does not implement them.

## Commit Messages

- Follow [Conventional Commits](https://www.conventionalcommits.org/).
- English.
- Include a scope. Use module names: `cli`, `core`, `output`, `types`, `tests`, `ci`, `docs`, `deps`, `release`.
- Body explains **why**, not what. The diff already shows what.

## Design source of truth

Phase 0 design docs live at:
`https://github.com/***/tree/main/project/agent-carnet`

Specifically:
- `README.md` — concept and storage model
- `CLI.md` — canonical CLI spec
- `ROADMAP.md` — phase boundaries
- `BACKGROUND.md` — design philosophy

Refer back to those when extending; this CLAUDE.md only summarises.

<div align="center">
  <img src="./docs/logo.svg" alt="Agent Carnet" width="180" height="auto" />
  <h1>Agent Carnet 📓</h1>
  <p align="center">
    <span><i>un petit carnet</i> for AI agents — and the humans who work with them</span>
  </p>
</div>

<hr />

<p align="center">
  <a href="https://www.npmjs.com/package/agent-carnet"><img src="https://img.shields.io/npm/v/agent-carnet.svg?maxAge=1000" alt="npm"></a>
  <a href="https://www.npmjs.com/package/agent-carnet"><img src="https://img.shields.io/npm/dt/agent-carnet.svg" alt="downloads"></a>
  <a href="https://github.com/yamadashy/agent-carnet/actions/workflows/ci.yml"><img src="https://github.com/yamadashy/agent-carnet/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
</p>

**Agent Carnet** (pronounced `/ˌeɪdʒənt kɑːrˈneɪ/`, like "agent kar-NAY") is a tiny CLI — `agent-carnet` — that gives AI coding agents (Claude Code, Codex, Cursor) a shared notebook on disk. Each note is a markdown file under `.carnet/<category>/<slug>.md`.

<!-- TODO: capture ./docs/screenshots/terminal.png (a side-by-side of `agent-carnet list` and `agent-carnet show`) and uncomment.
<p align="center">
  <img src="./docs/screenshots/terminal.png" alt="agent-carnet list and show output, with category-grouped carnets and a styled markdown view" />
</p>
-->

## Why Agent Carnet

**Notes are just markdown files.** Most agent-memory tools hide notes inside a vector DB or proprietary store, so you cannot `grep`, `git diff`, or hand-edit them. Agent Carnet keeps every note as a plain `.md` file under `.carnet/`. The agent writes through the CLI; you read and review the exact same files with the tools you already use. Anything that can shell out — Claude Code, Codex, Cursor, your own scripts — works against the same notebook. No SDK, no MCP, no daemon.

**Stale notes disappear on their own.** A note-store that only grows is a note-store that rots. Every carnet has a 30-day lifespan that resets each time it is read or written, so useful notes survive and the rest drift to `.trash/` automatically (with a 7-day grace period before deletion). Pin anything you cannot afford to lose with `keep: true`. The notebook stays alive without manual cleanup.

## Quick start

```bash
# Initialize a notebook in the current directory
npx agent-carnet init

# Save a note (stdin or --body)
echo "Notes about iconv-esm interop." | npx agent-carnet save deps/iconv-issue \
  --summary "iconv-esm compatibility fix" \
  --agent claude-code \
  --tags compat,esm

# Look around
npx agent-carnet list
npx agent-carnet find iconv
npx agent-carnet show deps/iconv-issue
```

Or install once:

```bash
npm install -g agent-carnet
```

## Install the Claude Code skill

Agent Carnet ships a bundled skill at `skills/agent-carnet/` (`SKILL.md` plus a small `references/` set) so any Claude Code, Codex, or Cursor session knows when to reach for the CLI. Install it with [`npx skills`](https://github.com/vercel-labs/skills), the open agent-skills installer:

```bash
# Project install (default) — drops the skill into <cwd>/.claude/skills/agent-carnet/
npx skills add yamadashy/agent-carnet

# Global install — drops it into ~/.claude/skills/agent-carnet/ instead
npx skills add yamadashy/agent-carnet -g
```

`npx skills` handles the install / uninstall / list lifecycle uniformly across agents, so Agent Carnet itself doesn't need to know about Claude Code's filesystem layout.

## Commands

| Command | What it does |
|---|---|
| `init [--gitignore]` | Create `.carnet/` in the current directory. `--gitignore` adds an entry. |
| `save <category>/<slug> --summary <s> --agent <a> [--tags] [--related] [--body or stdin] [--lifespan] [--keep] [--update]` | Create or update a carnet. |
| `list [category] [--recent N] [--tags a,b] [--expiring 7d] [--sort updated\|created\|name]` | List carnets, grouped by category. |
| `find <keyword> [--in summary\|tags\|body\|all] [--category] [--limit N]` | Pure-JS search. Default scope is `summary`. Does **not** refresh `updated`. |
| `show <category>/<slug> [--no-touch] [--no-frontmatter]` | Print a carnet. By default this bumps `updated` to today. |
| `touch <category>/<slug>` | Bump `updated` to today **without** reading the body — keep a carnet alive cheaply. |
| `move <from> <to> [--update]` | Move a carnet between categories. Trailing `/` on `<to>` keeps the source filename. |
| `rm <category>/<slug> [--yes] [--hard]` | Delete one carnet. Soft-delete to `.trash/` by default; `--hard` unlinks immediately. |
| `prune [--dry-run] [--auto] [--interactive] [--include-trash]` | Move expired carnets to `.trash/`. `--interactive` prompts per carnet (`y`/`N`/`q`). |

Global flags: `--json`, `--no-color`, `--no-auto-prune`, `--quiet`, `--help`, `--version`.

Per-subcommand help: `agent-carnet <command> -h` (e.g. `agent-carnet save -h`) prints the focused help for that command — required arguments, all options, and examples — without touching the filesystem.

Skill installation lives outside the CLI — see [Install the Claude Code skill](#install-the-claude-code-skill) above for the `npx skills` flow.

## Frontmatter schema

```yaml
---
summary: "iconv-esm compatibility fix"   # required (one line)
agent: claude-code                       # required (claude-code, codex, cursor, human, ...)
created: 2026-05-04                      # CLI-managed
updated: 2026-05-04                      # CLI-managed (refresh-on-use)
tags: [compat, esm]                      # optional
related:                                 # optional (paths or other carnets)
  - src/core/file/encoding.ts
lifespan: 90d                            # optional (override default 30d)
keep: true                               # optional (pin against auto-prune)
meta:                                    # optional, free-form extension namespace
  <extension>:
    <key>: <value>
---
```

Notes:
- `lifespan` accepts duration strings (`30d`, `90d`, `1y`) and the literal `never`.
- `meta:` is a deliberate extension point for tools and conventions that need structured data beyond what `tags:` and `related:` express. The CLI does not interpret `meta:` itself — it preserves the full subtree on every read/write so downstream consumers (an Obsidian plugin, a sibling agent, your own script) can read and act on it. Namespace keys under the convention name (`meta.vocab.*`, `meta.hypothesis.*`) so different extensions don't collide.

## Storage layout

```
<cwd>/.carnet/
├── <category>/
│   └── <slug>.md
├── <category>/<sub>/
│   └── <slug>.md
└── .trash/                  # safety net for auto-pruned carnets
    └── <category>/
        └── <slug>.md
```

Phase 1 stores carnets only under the current working directory. A global `~/.carnet/` and `--scope` flag may come later.

## Configuration

Phase 1 has no config file. Behavior is controlled by environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `AGENT_CARNET_AUTO_PRUNE` | `true` | Run lifespan/trash sweep on every CLI invocation. |
| `AGENT_CARNET_DEFAULT_LIFESPAN` | `30d` | Default per-carnet expiry. |
| `AGENT_CARNET_TRASH_TTL` | `7d` | How long `.trash/` keeps soft-deleted carnets before hard delete. |

## Lifespan

Every carnet has an expiry date. It is computed from two frontmatter fields:

```
expiry = updated + lifespan
```

- `updated` — last time the carnet was touched (YYYY-MM-DD, UTC, CLI-managed).
- `lifespan` — duration string (`30d`, `90d`, `1y`, `never`). Defaults to `AGENT_CARNET_DEFAULT_LIFESPAN` (`30d`) when omitted.

When `expiry <= today`, the carnet is considered stale.

### Refresh-on-use

The only way to extend a carnet's life is to **use it**. Reading or writing it bumps `updated` to today, which pushes the expiry forward by another full lifespan.

| Action | Bumps `updated`? |
|---|---|
| `save <path>` (create or overwrite) | Yes |
| `save <path> --update` (frontmatter-only refresh) | Yes |
| `touch <path>` (refresh without reading the body) | Yes |
| `show <path>` | Yes (pass `--no-touch` to peek without leaving fingerprints) |
| `find <keyword>` | **No** — matching is not the same as reading |
| `list`, `move`, `rm` | No |

Useful notes survive because they get read. Notes nobody touches drift toward expiry on their own — no manual triage required.

### State transitions

```
[live] ──auto-prune──▶ [.trash/] ──TTL exceeded──▶ [hard delete]
   ▲                       │
   └────── restore ────────┘     (just `mv` the file back)
```

1. **live** (`.carnet/<category>/<slug>.md`) — the working notebook.
2. **trash** (`.carnet/.trash/<category>/<slug>.md`) — soft-deleted carnets, kept for `AGENT_CARNET_TRASH_TTL` (default `7d`). Original sub-path is preserved, so restoring is `mv .carnet/.trash/foo/bar.md .carnet/foo/bar.md`.
3. **hard delete** — anything in `.trash/` whose mtime is older than the trash TTL is unlinked permanently.

### Auto-prune

Every CLI invocation (except `--help` / `--version`) sweeps the notebook:

1. Walks `.carnet/` and moves carnets where `expiry <= today` to `.trash/`.
2. Hard-deletes anything in `.trash/` whose mtime is older than the trash TTL.

Opt out per call with `--no-auto-prune`, or globally with `AGENT_CARNET_AUTO_PRUNE=false` and run `agent-carnet prune --auto` from CI instead. The latter is the recommended pattern for shared, git-tracked notebooks: each developer's local CLI should not silently delete other people's carnets.

### Exemptions

A carnet never expires when:

- `keep: true` is set (explicit pin), or
- `lifespan: never` is set, or
- `updated` is missing (treated as "freshly imported, not yet measured" — the safety valve that prevents a one-shot `agent-carnet list` from sweeping unmigrated notes into `.trash/`).

## Cookbook

Agent Carnet is just a folder of markdown files; useful patterns emerge from how you tag and link them, not from special folders or commands. The example below stays inside the existing CLI surface — only the `tags:` field carries the convention, so the carnet remains a portable markdown file you can also open in Obsidian, VS Code, or any editor.

### Vocabulary alignment

Multiple agents (and humans) routinely invent different names for the same concept — Claude Code calls something "staging adapter", Codex writes "proxy layer", a human's note uses "forward middleware". By the time anyone notices, three identifiers have leaked into the codebase.

Use one carnet per term, tagged with `vocab`. The `tags:` value declares membership; the optional `meta.vocab.*` subtree carries structured data downstream tools can act on (resolve an alias to its canonical, list rejected names, etc.) while the body explains the *why* in narrative form:

```yaml
---
summary: "staging adapter — the thin proxy in front of POST /v1/stage"
agent: claude-code
tags: [vocab]
related:
  - .carnet/vocab/payload-envelope.md
  - src/staging/adapter.ts
meta:
  vocab:
    canonical: staging adapter
    aliases:
      - proxy layer
      - forward middleware
      - request shim
---

# staging adapter

## Definition
The thin proxy that fronts the production gateway and reshapes incoming
requests into the `payload-envelope` format. Nothing more.

## Why this name
"proxy" is overloaded; "middleware" collides with the Express concept.
"staging adapter" leaves no doubt about which layer is meant.
```

The agent-side flow is small. Before naming a new concept, the agent checks whether someone already named it:

```bash
agent-carnet find <candidate> --in tags
```

If a term wins out, the canonical version is saved once, and every subsequent agent (Claude Code, Codex, Cursor, ...) can find it the same way:

```bash
echo "..." | agent-carnet save vocab/staging-adapter \
  --summary "staging adapter — the thin proxy in front of POST /v1/stage" \
  --agent claude-code \
  --tags vocab
```

Refresh-on-use does the rest: synonyms that keep getting cited stay alive, ones that nobody invokes drift to `.trash/` automatically. The `vocab` tag is purely a project-level convention — the file is just markdown, and Agent Carnet itself does not know or care that it represents a term.

### Hypothesis ledger

Long debugging sessions keep producing dead-ends — "we tried X and it didn't work because Y" — and the next session (or the next agent) cheerfully retries the same thing. Vector search and `CLAUDE.md` skim well for "what worked"; they're worse at "what was already tried and ruled out". A small carnet per hypothesis fixes that with no extra machinery: tag it `hypothesis`, write the test and the verdict in the body, let `meta.hypothesis.*` carry the structured status:

```yaml
---
summary: "iconv-lite v0.7 esm import path — types broken upstream"
agent: claude-code
tags: [hypothesis]
related:
  - https://github.com/pillarjs/iconv-lite/issues/363
meta:
  hypothesis:
    status: debunked
    last_tested: 2026-04-30
---

## Hypothesis
Switching to esm imports should let us run `iconv-lite` on Node 22
(v0.7 advertises ESM support).

## Tests
1. `npm install iconv-lite@0.7.1` → type error (`Cannot find module declaration`).
2. Set `tsconfig.moduleResolution` to `bundler` → same error.
3. Inspected v0.7.1 source → broken `package.json#exports` types.

## Verdict
Pin to `v0.6.3`. The whole v0.7 series is broken upstream (Issue #363).
Wait for v0.8 before retrying.
```

Before exploring a new theory, the agent checks whether anyone has been here before:

```bash
agent-carnet find <symptom> --in all
agent-carnet find <library> --in tags    # narrow to hypothesis: notes
```

If a hypothesis is debunked, the body explains *why* and the agent (or human) moves on without burning the same evidence again. Refresh-on-use turns staleness into signal: a debunked hypothesis nobody has needed to consult in 30 days drops to `.trash/`, which is the right behavior — by then either the library has moved or the problem isn't recurring. The hypotheses that *do* keep getting cited are the load-bearing "do not touch" entries.

## How it differs from built-in agent memory

|   | Vendor-managed agent memory | **Agent Carnet** |
|---|---|---|
| Agents that can use it | One vendor's tool only | Any (the interface is `bash`) |
| Storage | Opaque, server- or vendor-managed | Plain markdown files on your disk |
| File-direct edits | Not possible | Encouraged — open in any editor |
| Lifespan enforcement | LLM-judged or none | CLI-enforced (auto-prune to `.trash/`) |
| Frontmatter validation | n/a | CLI-enforced (`summary`/`agent` required) |

Agent Carnet is intentionally less ambitious than vendor memories: it does not try to summarize, embed, or reason about your notes. It is just a tidy, auto-expiring file shelf you can share between agents.

## Development

```bash
npm install
npm run lint     # biome + oxlint + tsgo + secretlint
npm run test     # vitest
npm run build    # tsdown bundle
```

Source layout mirrors [pdfvision](https://github.com/yamadashy/pdfvision):

```
src/
├── bin/agent-carnet.ts   # thin entry point
├── cli/                  # argv parsing, help, version, stdin
├── core/                 # pure-ish logic (no process.exit, no console.log)
├── output/               # human + JSON formatters
└── types/                # shared types
```

## License

MIT (c) 2026 Kazuki Yamada

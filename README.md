# agent-carnet

[![npm](https://img.shields.io/npm/v/agent-carnet.svg?maxAge=1000)](https://www.npmjs.com/package/agent-carnet)
[![CI](https://github.com/yamadashy/agent-carnet/actions/workflows/ci.yml/badge.svg)](https://github.com/yamadashy/agent-carnet/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/agent-carnet)](LICENSE)

> A leather notebook in your jacket pocket, for AI agents.

`agent-carnet` is a small CLI for AI agents (Claude Code, Codex, Cursor, ...) and humans to record markdown notes, organized by category, with auto-expiry. Each *carnet* is a single markdown file with YAML frontmatter, stored under `.agent-carnet/<category>/<slug>.md`.

It is the CLI evolution of the `agent-memory` skill: the same "safe to forget" model, repackaged as a tool any agent can call via shell.

## Why agent-carnet

- **Records, not memories.** A carnet is a fact written to disk, not a model's hidden state. You can grep it, diff it, commit it, and read it without an LLM.
- **Agent-agnostic.** Any agent that can run a shell command can write to the same shared notebook. No vendor lock-in.
- **Safe to forget.** Each carnet has a 30-day default lifespan that resets every time it is read. Stale notes drift to `.trash/` automatically; useful ones survive.
- **Honest framing.** No "brain", no "cognitive", no "AI memory". It's a file-management CLI with a polite expiry policy.

If you want a deeper dive into the philosophy and the road from `agent-memory` skill to `agent-carnet`, the design docs live at [***/project/agent-carnet](https://github.com/***/tree/main/project/agent-carnet).

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

## Commands

| Command | What it does |
|---|---|
| `init [--gitignore]` | Create `.agent-carnet/` in the current directory. `--gitignore` adds an entry. |
| `save <category>/<slug> --summary <s> --agent <a> [--tags] [--related] [--body or stdin] [--lifespan] [--keep] [--update]` | Create or update a carnet. |
| `list [category] [--recent N] [--tags a,b] [--expiring 7d] [--sort updated\|created\|name]` | List carnets, grouped by category. |
| `find <keyword> [--in summary\|tags\|body\|all] [--category] [--limit N]` | Pure-JS search. Default scope is `summary`. Does **not** refresh `updated`. |
| `show <category>/<slug> [--no-touch] [--no-frontmatter]` | Print a carnet. By default this bumps `updated` to today. |
| `prune [--dry-run] [--auto] [--include-trash]` | Move expired carnets to `.trash/`; optionally hard-delete from `.trash/`. |
| `import [src] [--dry-run]` | Migrate from the legacy `memories/` (agent-memory skill) format. |

Global flags: `--json`, `--no-color`, `--no-auto-prune`, `--quiet`, `--help`, `--version`.

> **Phase 1 scope.** `touch`, `move`, and `rm` are planned for Phase 2. See the [roadmap](https://github.com/***/blob/main/project/agent-carnet/ROADMAP.md).

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
---
```

Notes:
- There is **no `status` field**. The legacy skill had one; `agent-carnet import` lifts `status: <v>` into `tags: [status:<v>]` so no information is lost.
- `lifespan` accepts duration strings (`30d`, `90d`, `1y`) and the literal `never`.

## Storage layout

```
<cwd>/.agent-carnet/
├── <category>/
│   └── <slug>.md
├── <category>/<sub>/
│   └── <slug>.md
└── .trash/                  # safety net for auto-pruned carnets
    └── <category>/
        └── <slug>.md
```

Phase 1 stores carnets only under the current working directory. A global `~/.agent-carnet/` and `--scope` flag may come later.

## Configuration

Phase 1 has no config file. Behavior is controlled by environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `AGENT_CARNET_AUTO_PRUNE` | `true` | Run lifespan/trash sweep on every CLI invocation. |
| `AGENT_CARNET_DEFAULT_LIFESPAN` | `30d` | Default per-carnet expiry. |
| `AGENT_CARNET_TRASH_TTL` | `7d` | How long `.trash/` keeps soft-deleted carnets before hard delete. |

## Auto-prune behavior

On every CLI invocation (except `--help` / `--version`), agent-carnet:

1. Walks `.agent-carnet/` and identifies carnets whose `updated + lifespan` is in the past.
2. Moves them to `.agent-carnet/.trash/`, preserving the original sub-path.
3. Hard-deletes anything in `.trash/` whose mtime is older than `AGENT_CARNET_TRASH_TTL`.

You can opt out per call with `--no-auto-prune`, or globally with `AGENT_CARNET_AUTO_PRUNE=false` and run `agent-carnet prune --auto` from CI instead. The latter is the recommended pattern for shared, git-tracked notebooks: each developer's local CLI does not silently delete other people's carnets.

`keep: true` and `lifespan: never` carnets are always exempt.

### Refresh-on-use

`show` bumps `updated` to today by default — reading a carnet is the only way to extend its life. `find` does **not** refresh; matching the keyword is not the same as actually reading the note. Pass `--no-touch` to `show` if you need a peek without leaving fingerprints.

## How it differs from Claude memory and agent-memory skill

|   | Claude built-in memory | agent-memory skill | **agent-carnet** |
|---|---|---|---|
| Agents that can use it | Claude Code only | Claude Code only | Any (CLI = shell) |
| Storage | Vendor-managed | `memories/*.md` | `.agent-carnet/*.md` |
| File-direct edits | No | Yes | Yes |
| Lifespan enforcement | n/a | LLM-judged | CLI-enforced (auto-prune to `.trash/`) |
| Frontmatter validation | n/a | None | CLI-enforced (`summary`/`agent` required) |
| Migration | n/a | n/a | `agent-carnet import memories/` |

`agent-carnet` is intentionally less ambitious than vendor memories: it does not try to summarize, embed, or reason about your notes. It is just a tidy, auto-expiring file shelf you can share between agents.

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

Phase 2+ work is tracked in the upstream design docs at [***/project/agent-carnet](https://github.com/***/tree/main/project/agent-carnet).

## License

MIT (c) 2026 Kazuki Yamada

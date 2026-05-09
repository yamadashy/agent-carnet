<div align="center">
  <!-- TODO: drop ./docs/logo.svg in once the leather-notebook icon is ready, then uncomment.
  <img src="./docs/logo.svg" alt="agent-carnet" width="180" height="auto" />
  -->
  <h1>agent-carnet 📓</h1>
  <p align="center">
    <span><i>un petit carnet</i> for AI agents — and the humans who work with them</span>
  </p>
</div>

<hr />

<p align="center">
  <a href="https://www.npmjs.com/package/agent-carnet"><img src="https://img.shields.io/npm/v/agent-carnet.svg?maxAge=1000" alt="npm"></a>
  <a href="https://www.npmjs.com/package/agent-carnet"><img src="https://img.shields.io/npm/dm/agent-carnet.svg" alt="downloads"></a>
  <a href="https://github.com/yamadashy/agent-carnet/actions/workflows/ci.yml"><img src="https://github.com/yamadashy/agent-carnet/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
</p>

`agent-carnet` is a tiny CLI that gives any AI coding agent — Claude Code, Codex, Cursor, you name it — a shared notebook on disk. Each note is a single markdown file with YAML frontmatter under `.agent-carnet/<category>/<slug>.md`, the kind of file you can `grep`, `cat`, `git diff`, and read with your own eyes, no LLM in the loop.

Where most "AI memory" systems quietly hoard everything an agent ever did into an opaque database, agent-carnet does the opposite. The agent has to **decide** something is worth writing, names it, and the file lives there on disk for anyone to read or edit. Notes carry a 30-day default lifespan that resets every time they're read — useful ones survive, stale ones drift to `.trash/` on their own. The agent calls `save`, `find`, `show`; you `cat`, `grep`, or edit by hand. Same files, two ways in.

The mental model is the leather notebook a quietly meticulous agent slips from a jacket pocket, jots a single line into, and snaps shut. Not a cybernetic brain implant — just a small, honest carnet that any agent or human can pick up and read.

<!-- TODO: capture ./docs/screenshots/terminal.png (a side-by-side of `agent-carnet list` and `agent-carnet show`) and uncomment.
<p align="center">
  <img src="./docs/screenshots/terminal.png" alt="agent-carnet list and show output, with category-grouped carnets and a styled markdown view" />
</p>
-->

If you want a deeper dive into the philosophy and the road from the `agent-memory` skill to `agent-carnet`, the design docs live at [***/project/agent-carnet](https://github.com/***/tree/main/project/agent-carnet).

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
| `touch <category>/<slug>` | Bump `updated` to today **without** reading the body — keep a carnet alive cheaply. |
| `move <from> <to> [--update]` | Move a carnet between categories. Trailing `/` on `<to>` keeps the source filename. |
| `rm <category>/<slug> [--yes] [--hard]` | Delete one carnet. Soft-delete to `.trash/` by default; `--hard` unlinks immediately. |
| `prune [--dry-run] [--auto] [--interactive] [--include-trash]` | Move expired carnets to `.trash/`. `--interactive` prompts per carnet (`y`/`N`/`q`). |
| `import [src] [--dry-run]` | Migrate from the legacy `memories/` (agent-memory skill) format. |

Global flags: `--json`, `--no-color`, `--no-auto-prune`, `--quiet`, `--help`, `--version`.

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

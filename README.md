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

`agent-carnet` (pronounced `/ˌeɪdʒənt kɑːrˈneɪ/`, like "agent kar-NAY") is a tiny CLI that gives AI coding agents — Claude Code, Codex, Cursor — a shared notebook on disk. Each note is a markdown file with YAML frontmatter under `.agent-carnet/<category>/<slug>.md`, ready to `grep`, `cat`, `git diff`, or edit by hand.

The agent saves notes explicitly — nothing is captured in the background. Each carnet has a 30-day default lifespan that resets every time it is read, so useful notes survive while stale ones drift to `.trash/` on their own. The agent calls `save`, `find`, `show`; you `cat`, `grep`, or edit. Same files, two ways in.

<!-- TODO: capture ./docs/screenshots/terminal.png (a side-by-side of `agent-carnet list` and `agent-carnet show`) and uncomment.
<p align="center">
  <img src="./docs/screenshots/terminal.png" alt="agent-carnet list and show output, with category-grouped carnets and a styled markdown view" />
</p>
-->

Design docs and the road from the `agent-memory` skill live at [***/project/agent-carnet](https://github.com/***/tree/main/project/agent-carnet).

## Why agent-carnet

**Records, not memories.** Notes are files, not opaque model state. Grep them, diff them, hand-edit them, copy them between projects — no LLM, no database, no service to call.

**Agent-agnostic.** Anything that can shell out reads and writes the same notebook. No SDK, no MCP, no daemon. Multiple agents in the same project see the same notes the same way.

**Safe to forget.** The 30-day lifespan plus refresh-on-use means useful notes earn their keep and the rest fades. Auto-prune routes everything through `.trash/` with a 7-day grace period, and `keep: true` pins anything you would rather not lose.

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
meta:                                    # optional, free-form extension namespace
  <extension>:
    <key>: <value>
---
```

Notes:
- There is **no `status` field**. The legacy skill had one; `agent-carnet import` lifts `status: <v>` into `tags: [status:<v>]` so no information is lost.
- `lifespan` accepts duration strings (`30d`, `90d`, `1y`) and the literal `never`.
- `meta:` is a deliberate extension point for tools and conventions that need structured data beyond what `tags:` and `related:` express. The CLI does not interpret `meta:` itself — it preserves the full subtree on every read/write so downstream consumers (an Obsidian plugin, a sibling agent, your own script) can read and act on it. Namespace keys under the convention name (`meta.vocab.*`, `meta.hypothesis.*`) so different extensions don't collide.

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

## Cookbook

agent-carnet is just a folder of markdown files; useful patterns emerge from how you tag and link them, not from special folders or commands. The example below stays inside the existing CLI surface — only the `tags:` field carries the convention, so the carnet remains a portable markdown file you can also open in Obsidian, VS Code, or any editor.

### Vocabulary alignment

Multiple agents (and humans) routinely invent different names for the same concept — Claude Code calls something "staging adapter", Codex writes "proxy layer", a human's note uses "forward middleware". By the time anyone notices, three identifiers have leaked into the codebase.

Use one carnet per term, tagged with `vocab`. The `tags:` value declares membership; the optional `meta.vocab.*` subtree carries structured data downstream tools can act on (resolve an alias to its canonical, list rejected names, etc.) while the body explains the *why* in narrative form:

```yaml
---
summary: "staging adapter — the thin proxy in front of POST /v1/stage"
agent: claude-code
tags: [vocab]
related:
  - .agent-carnet/vocab/payload-envelope.md
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

Refresh-on-use does the rest: synonyms that keep getting cited stay alive, ones that nobody invokes drift to `.trash/` automatically. The `vocab` tag is purely a project-level convention — the file is just markdown, and agent-carnet itself does not know or care that it represents a term.

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

---
name: agent-carnet
description: "Use this skill when the user asks to save, recall, find, or organize notes. Triggers on: 'remember this', 'save this', 'note this', 'what did we discuss about...', 'check the notebook', 'find in carnet'. Also use proactively when discovering findings worth preserving across sessions."
---

# Agent Carnet

A tiny CLI that gives you a shared markdown notebook on disk under `.agent-carnet/<category>/<slug>.md`. Notes have a 30-day default lifespan that resets every time they are read; useful ones survive, stale ones drift to `.trash/` automatically.

## Quick reference

```bash
# Save (always pass --summary and --agent claude-code)
echo "body content" | agent-carnet save deps/iconv-issue \
  --summary "iconv-esm v0.7 types broken — pin to v0.6" \
  --agent claude-code \
  --tags compat,esm

# Recall
agent-carnet find iconv               # search summaries (does NOT bump lifespan)
agent-carnet list                     # category-grouped overview
agent-carnet list --recent 10         # most recently updated
agent-carnet show deps/iconv-issue    # read full content (bumps lifespan to today)

# Maintain
agent-carnet touch <path>             # bump lifespan without reading
agent-carnet move <from> <to>
agent-carnet rm <path> --yes
```

## When to save

Save proactively when you discover something worth preserving across sessions:
- Research findings that took effort to derive
- Non-obvious patterns / gotchas in the codebase
- Solutions to tricky problems
- Architectural decisions and the reasoning behind them
- In-progress work that may be resumed later

## When to recall

Before starting related work or when context might exist:
- `agent-carnet find <topic>` — quick scan of summaries
- `agent-carnet list <category>` — browse a folder
- `agent-carnet show <path>` — actually read (this resets the lifespan; only use when the content matters)

## Hard rules

- `--summary` is required. Make it decisive — reading the summary in isolation tells the next reader (or the next agent) whether to read further.
- `--agent claude-code` is required.
- `find` does NOT bump lifespan. `show` does. Bumping requires actually reading the body.
- The 30-day expiry is automatic — do not manually clean up. `keep: true` pins permanent notes (set via direct file edit or `--keep` on save).
- Auto-prune runs on every CLI invocation; deleted carnets land in `.agent-carnet/.trash/` for 7 days before hard delete.

## Path conventions

- `<category>/<slug>` — kebab-case, no leading slash, no `..`.
- Categories are folders; create new ones freely as needed.
- Subcategories are allowed: `deps/esm/iconv-issue` works.

## Conventions worth knowing

The README documents a couple of tag-only patterns that need no extra commands:
- `tags: [vocab]` for project terminology (one carnet per term)
- `tags: [hypothesis]` for debugging dead-ends with `meta.hypothesis.status`

Apply them when they fit, ignore them otherwise — they are conventions, not features.

See https://github.com/yamadashy/agent-carnet#cookbook for full examples.

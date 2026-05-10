export const HELP_TEXT = `agent-carnet - File-based markdown notebook CLI for AI agents

Usage:
  agent-carnet <command> [args] [options]

Commands:
  init                       Create ./.carnet/
  save <category>/<slug>     Create or update a carnet (--summary, --agent required)
  list [category]            List carnets (--recent, --tags, --expiring, --sort)
  find <keyword>             Search carnets (--in summary|tags|body|all, --category)
  show <category>/<slug>     Print a carnet (bumps "last_used" unless --no-touch)
  used <category>/<slug>     Mark a carnet as applied: bump "last_used" + use_count
  move <from> <to>           Move a carnet to a new category (use trailing / to keep filename)
  rm <category>/<slug>       Delete a carnet (.trash/ by default; --hard to unlink, --yes to skip prompt)
  prune                      Move expired carnets to .trash/ (--dry-run, --auto, --interactive)

Run \`agent-carnet <command> -h\` for per-command help (options, examples).

Global options:
      --json                 Machine-readable output
      --no-color             Disable color
      --no-auto-prune        Skip auto-prune for this invocation
      --quiet                Suppress notification messages
  -v, --version              Show version
  -h, --help                 Show this help

Environment variables:
  AGENT_CARNET_AUTO_PRUNE        Toggle auto-prune (default: true)
  AGENT_CARNET_DEFAULT_LIFESPAN  Default lifespan per carnet (default: 30d)
  AGENT_CARNET_TRASH_TTL         How long .trash/ keeps deleted carnets (default: 7d)

Storage:
  All carnets live under <cwd>/.carnet/<category>/<slug>.md
  Expired carnets are moved to <cwd>/.carnet/.trash/

Examples:
  agent-carnet init --gitignore
  echo "details..." | agent-carnet save deps/iconv-issue --summary "iconv-esm fix" --agent claude-code
  agent-carnet list --recent 10
  agent-carnet find iconv --in all
  agent-carnet show deps/iconv-issue
  agent-carnet used deps/iconv-issue
  agent-carnet move deps/iconv-issue archive/
  agent-carnet rm deps/iconv-issue --yes
  agent-carnet prune --interactive
`;

const INIT_HELP = `agent-carnet init - Create ./.carnet/ in the current directory

Usage:
  agent-carnet init [options]

Options:
  --gitignore   Add an entry for .carnet/ to .gitignore (creates the file if missing)

Examples:
  agent-carnet init
  agent-carnet init --gitignore
`;

const SAVE_HELP = `agent-carnet save - Create or update a carnet

Usage:
  agent-carnet save <category>/<slug> --summary <text> --agent <name> [options]

Required:
  <category>/<slug>      Path under .carnet/ (kebab-case, no leading slash, no '..').
  --summary <text>       One-line summary. The first thing the next reader sees.
  --agent <name>         Note author (claude-code, codex, cursor, human, ...).

Options:
  --tags <a,b,c>         Comma-separated tags.
  --related <p1,p2>      Comma-separated related paths or other carnets.
  --body <text>          Inline body. Mutually exclusive with stdin.
  --lifespan <duration>  Override the default expiry. Examples: 30d, 90d, 1y, never.
  --keep                 Pin against auto-prune (lifespan is ignored).
  --update               Overwrite an existing carnet. Preserves unknown frontmatter
                         (e.g. the meta: subtree) verbatim.

Body:
  Read from stdin if --body is not given. --body and stdin cannot be combined.

Examples:
  echo "details..." | agent-carnet save deps/iconv-issue \\
    --summary "iconv-esm v0.7 types broken — pin to v0.6" \\
    --agent claude-code \\
    --tags compat,esm

  agent-carnet save vocab/staging-adapter \\
    --summary "staging adapter — the thin proxy in front of POST /v1/stage" \\
    --agent claude-code \\
    --tags vocab \\
    --body "..."
`;

const LIST_HELP = `agent-carnet list - List carnets, grouped by category

Usage:
  agent-carnet list [category] [options]

Arguments:
  [category]             Restrict to a single top-level category.

Options:
  --recent <N>           Show only the N most recently used carnets.
  --tags <a,b,c>         Restrict to carnets that carry all of the given tags.
  --expiring <duration>  Restrict to carnets expiring within the given window
                         (e.g. 7d, 30d).
  --sort <field>         last_used (default) | updated | created | name | use_count.

Examples:
  agent-carnet list
  agent-carnet list deps
  agent-carnet list --recent 10
  agent-carnet list --tags vocab
  agent-carnet list --expiring 7d --sort last_used
  agent-carnet list --sort use_count          # most-applied notes first
`;

const FIND_HELP = `agent-carnet find - Search carnets (does NOT bump "updated")

Usage:
  agent-carnet find <keyword> [options]

Arguments:
  <keyword>              Substring to search for. Case-insensitive.

Options:
  --in <scope>           summary (default) | tags | body | all.
  --category <name>      Restrict to a single category.
  --limit <N>            Cap the number of hits returned.

Note:
  find is intentionally a peek — matching a keyword is not the same as reading
  the carnet, so "updated" is not bumped. Use \`show\` when you actually need to
  refresh the lifespan.

Examples:
  agent-carnet find iconv
  agent-carnet find encoding --in body --limit 5
  agent-carnet find vocab --in tags
`;

const SHOW_HELP = `agent-carnet show - Print a carnet (bumps "last_used" to today by default)

Usage:
  agent-carnet show <category>/<slug> [options]

Arguments:
  <category>/<slug>      Path of the carnet to print.

Options:
  --no-touch             Print without bumping "last_used". Use for previews
                         that should not extend the lifespan.
  --no-frontmatter       Suppress the YAML frontmatter from the output.

Notes:
  show is the *weak* use signal — pulling the body into context resets the
  lifespan but does NOT increment "use_count". When the carnet actually
  shapes your work, follow up with \`agent-carnet used <path>\` to record
  the strong signal.

Examples:
  agent-carnet show deps/iconv-issue
  agent-carnet show deps/iconv-issue --no-touch
  agent-carnet show vocab/staging-adapter --no-frontmatter
`;

const USED_HELP = `agent-carnet used - Mark a carnet as applied (strong use signal)

Usage:
  agent-carnet used <category>/<slug>

Arguments:
  <category>/<slug>      Path of the carnet to mark as used.

What it does:
  - Bumps "last_used" to today (resets the lifespan).
  - Increments "use_count" by 1.
  - Does NOT read the body — cheap to call inside an agent loop.

When to call:
  After you actually applied a carnet's content to the work — solving a
  bug with the recorded fix, citing a debunked hypothesis, reusing a
  vocabulary entry. \`show\` already keeps the carnet alive on read; \`used\`
  records the *importance* signal that survives across many sessions.

Examples:
  agent-carnet used deps/iconv-issue
  agent-carnet used vocab/staging-adapter
`;

const MOVE_HELP = `agent-carnet move - Move a carnet to a new category

Usage:
  agent-carnet move <from> <to> [options]

Arguments:
  <from>                 Source path under .carnet/.
  <to>                   Destination path. End with '/' to keep the source
                         filename (e.g. \`move deps/foo archive/\`).

Options:
  --update               Overwrite an existing destination.

Note:
  Frontmatter is preserved verbatim. "updated" is intentionally NOT bumped:
  reorganization is not "use".

Examples:
  agent-carnet move deps/iconv-issue archive/
  agent-carnet move deps/iconv-issue archive/iconv-resolved
  agent-carnet move deps/iconv-issue archive/iconv-resolved --update
`;

const RM_HELP = `agent-carnet rm - Delete a single carnet

Usage:
  agent-carnet rm <category>/<slug> [options]

Arguments:
  <category>/<slug>      Path of the carnet to delete.

Options:
  --yes                  Skip the confirmation prompt.
  --hard                 Unlink immediately (skip the .trash/ safety net).

Default behavior:
  Soft-delete to .trash/. The original sub-path is preserved, so restoring
  is a single \`mv\` from .carnet/.trash/<path> back to .carnet/<path>.

Examples:
  agent-carnet rm deps/iconv-issue
  agent-carnet rm deps/iconv-issue --yes
  agent-carnet rm deps/iconv-issue --hard --yes
`;

const PRUNE_HELP = `agent-carnet prune - Move expired carnets to .trash/

Usage:
  agent-carnet prune [options]

Options:
  --dry-run              Report what would be moved/deleted without changing files.
  --auto                 Non-interactive sweep. Suitable for CI.
  --interactive          Prompt per carnet (y/N/q). Quitting early keeps the rest.
  --include-trash        Also hard-delete .trash/ entries older than the trash TTL.

Notes:
  --interactive cannot be combined with --auto or --json.
  Carnets with \`keep: true\` or \`lifespan: never\` are always exempt.

Examples:
  agent-carnet prune --dry-run
  agent-carnet prune --interactive
  agent-carnet prune --auto --include-trash
`;

export const SUBCOMMAND_HELP: Record<string, string> = {
  init: INIT_HELP,
  save: SAVE_HELP,
  list: LIST_HELP,
  find: FIND_HELP,
  show: SHOW_HELP,
  used: USED_HELP,
  move: MOVE_HELP,
  rm: RM_HELP,
  prune: PRUNE_HELP,
};

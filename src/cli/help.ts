export const HELP_TEXT = `agent-carnet - File-based markdown notebook CLI for AI agents

Usage:
  agent-carnet <command> [args] [options]

Commands:
  init                       Create ./.agent-carnet/
  save <category>/<slug>     Create or update a carnet (--summary, --agent required)
  list [category]            List carnets (--recent, --tags, --expiring, --sort)
  find <keyword>             Search carnets (--in summary|tags|body|all, --category)
  show <category>/<slug>     Print a carnet (refreshes "updated" unless --no-touch)
  touch <category>/<slug>    Bump "updated" to today without reading the body
  move <from> <to>           Move a carnet to a new category (use trailing / to keep filename)
  rm <category>/<slug>       Delete a carnet (.trash/ by default; --hard to unlink, --yes to skip prompt)
  prune                      Move expired carnets to .trash/ (--dry-run, --auto, --interactive)
  skill install              Install the bundled SKILL.md into ~/.claude/skills/ (--here, --force)
  skill uninstall            Remove the installed SKILL.md (--here)
  skill path                 Print the SKILL.md install target (--here)

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
  All carnets live under <cwd>/.agent-carnet/<category>/<slug>.md
  Expired carnets are moved to <cwd>/.agent-carnet/.trash/

Examples:
  agent-carnet init --gitignore
  echo "details..." | agent-carnet save deps/iconv-issue --summary "iconv-esm fix" --agent claude-code
  agent-carnet list --recent 10
  agent-carnet find iconv --in all
  agent-carnet show deps/iconv-issue
  agent-carnet touch deps/iconv-issue
  agent-carnet move deps/iconv-issue archive/
  agent-carnet rm deps/iconv-issue --yes
  agent-carnet prune --interactive
  agent-carnet skill install
  agent-carnet skill install --here
`;

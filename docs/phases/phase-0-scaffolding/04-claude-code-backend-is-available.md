# Task: `ClaudeCodeBackend.isAvailable()`

**Phase:** [0 — Scaffolding & preflight](./overview.md)
**Status:** done

## Plan

`ClaudeCodeBackend.isAvailable()` — detect installed + logged-in Claude Code CLI.

## Implementation log

Thin subprocess wrapper — not unit tested, verified manually against a real `claude`
CLI in both states.

## Testing evidence

- Manually verified against both a logged-in and a logged-out `claude` CLI state —
  commit `51366fb`.

## Gotchas / drift from plan

- **Implementation choice**: considered three options — parsing OS keychain/credential
  files, a no-op `claude -p` call, or `claude auth status --json`. Went with the last:
  it's a documented subcommand, costs no tokens, and returns instantly, vs. keychain
  parsing being undocumented/platform-split and a no-op call costing real tokens +
  ~4s latency. Any failure (binary missing, non-zero exit, bad JSON) collapses to
  `false` — one code path covers both "not installed" and "not logged in".

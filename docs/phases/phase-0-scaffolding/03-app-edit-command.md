# Task: `ux-audit app edit`

**Phase:** [0 — Scaffolding & preflight](./overview.md)
**Status:** done

## Plan

`src/commands/app.ts` (`edit`) — re-prompt and overwrite `app.json`.

## Implementation log

Same interactive-flow shape as `init` ([02-init-command.md](./02-init-command.md)),
sharing that task's `APP_OVERVIEW_FIELDS` question set rather than redefining it — see
that task's Gotchas for why.

## Testing evidence

- `app edit` manually exercised via the `expect`-driven pty pattern (see `CLAUDE.md`) —
  same commit (`8635994`) that extracted the shared question set and documented the pty
  pattern.

## Gotchas / drift from plan

N/A

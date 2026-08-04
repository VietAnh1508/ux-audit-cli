# Task: `ux-audit init`

**Phase:** [0 — Scaffolding & preflight](./overview.md)
**Status:** done

## Plan

`src/commands/init.ts` — `@clack/prompts` flow scaffolding `.ux-audit/{config.json,
app.json, scenarios/, guidelines/w3c.json}`, prompts for `app.json` fields, appends
`credentials.local.json` to `.gitignore`.

**Acceptance**: `ux-audit init` on a throwaway directory produces a valid
`.ux-audit/`; running `ux-audit run` with no scenarios yet gives a clear, actionable
error instead of a stack trace.

## Implementation log

Interactive `@clack/prompts` flow with no browser or subprocess involved — verified
manually instead of unit tested (see `CLAUDE.md` → *Testing interactive commands
manually* for the pty-driving pattern this required, since piped stdin doesn't work
with `@clack`'s raw-mode TTY reads).

## Testing evidence

- `init` manually exercised via the `expect`-driven pty pattern (see `CLAUDE.md`) —
  commit `8635994` is where that testing pattern itself got documented, after `init`
  needed it first.

## Gotchas / drift from plan

- **Prompt-drift risk**: `init` and `app edit` ([03-app-edit-command.md](./03-app-edit-command.md))
  originally risked defining the `app.json` question set twice and drifting apart.
  Extracted `APP_OVERVIEW_FIELDS` into `src/commands/app-overview-fields.ts` so both
  commands share one source — commit `8635994`.

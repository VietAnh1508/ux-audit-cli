# Phase 0 — Scaffolding & preflight

**Status:** done. See [`../../IMPLEMENTATION_PLAN.md`](../../IMPLEMENTATION_PLAN.md) for
current overall status across all phases.

**Acceptance**: `ux-audit init` on a throwaway directory produces a valid
`.ux-audit/`; running `ux-audit run` with no scenarios yet gives a clear, actionable
error instead of a stack trace.

## Testing strategy

Per `UX_AUDIT_CLI_PLAN.md` Decision 7: `config/loader.ts` is deterministic, pure-logic
code, so it gets real `vitest` unit tests written before the implementation (TDD).
`init`/`app edit` are interactive `@clack/prompts` flows with no browser or subprocess
involved — not unit tested, verified manually instead (see `CLAUDE.md` → *Testing
interactive commands manually* for the pty-driving pattern this requires, since piped
stdin doesn't work with `@clack`'s raw-mode TTY reads). `ClaudeCodeBackend.isAvailable()`
is a thin subprocess wrapper — also manual, not unit tested.

## Tasks

Status here is a summary — each task file is the authoritative source; update it first,
then this checklist, then `IMPLEMENTATION_PLAN.md`.

- [x] [00-project-scaffolding-and-vitest.md](./00-project-scaffolding-and-vitest.md) —
      `package.json`/`tsconfig.json`/`.gitignore`/`src/` stub tree, vitest wired up first
- [x] [01-config-loader-load-config-and-load-app-overview.md](./01-config-loader-load-config-and-load-app-overview.md) —
      `loadConfig`/`loadAppOverview`
- [x] [02-init-command.md](./02-init-command.md) — `ux-audit init`
- [x] [03-app-edit-command.md](./03-app-edit-command.md) — `ux-audit app edit`
- [x] [04-claude-code-backend-is-available.md](./04-claude-code-backend-is-available.md) —
      `ClaudeCodeBackend.isAvailable()`

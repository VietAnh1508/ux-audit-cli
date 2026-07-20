# Phase 0 — Scaffolding & preflight

Status: **done**. See [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) for the
checklist and current overall status; this doc is the detail behind it.

## Plan

- `package.json`, `tsconfig.json`, `.gitignore`, `src/` skeleton — all modules present
  as typed stubs (`throw new Error("not implemented — see IMPLEMENTATION_PLAN.md Phase N")`).
- `vitest` wired up first, before any stub gets real logic (TDD — see Testing strategy
  below), no test files yet at this point.
- Playwright browser binaries (`pnpm exec playwright install`) confirmed as a one-time
  per-machine step, not covered by `pnpm install` — documented in `README.md`, not
  auto-installed by `ux-audit init`.
- `src/config/loader.ts` (`loadConfig`, `loadAppOverview`) — real fs read + zod
  validation, friendly "run `ux-audit init` first" error instead of raw ENOENT/zod
  error. `loadScenarios`/`loadCredentials`/`loadGuideline` stay stubs (later phases).
- `src/commands/init.ts` — `@clack/prompts` flow scaffolding `.ux-audit/{config.json,
  app.json, scenarios/, guidelines/w3c.json}`, prompts for `app.json` fields, appends
  `credentials.local.json` to `.gitignore`.
- `src/commands/app.ts` (`edit`) — re-prompt and overwrite `app.json`.
- `ClaudeCodeBackend.isAvailable()` — detect installed + logged-in Claude Code CLI.

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

## Testing evidence

- `pnpm test` (vitest) passing on an empty suite — commit `92334e0`.
- Playwright chromium install verified with a real `chromium.launch()` smoke test —
  commit `31172d6`.
- `src/config/loader.test.ts`: 8 cases for `loadConfig`/`loadAppOverview` against real
  temp directories (friendly-error paths for missing `.ux-audit/`, invalid JSON, failed
  zod validation; schema-defaults and explicit-value paths for both loaders) — commit
  `18a82bf`.
- `init` and `app edit` manually exercised via the `expect`-driven pty pattern (see
  `CLAUDE.md`) — commit `8635994` is where that testing pattern itself got documented,
  after `init` needed it first.
- `ClaudeCodeBackend.isAvailable()` manually verified against both a logged-in and a
  logged-out `claude` CLI state — commit `51366fb`.

## Gotchas / drift from plan

- **Editor false positives, not a real bug**: `tsc --noEmit` was clean but the VS Code
  editor showed spurious type errors. Root cause was the editor using a different
  TypeScript version than the project's. Fixed by pinning the workspace TS version via
  `.vscode/settings.json` — commit `18a82bf`. Worth knowing if a future session sees
  editor errors that `pnpm typecheck` doesn't reproduce.
- **`isAvailable()` implementation choice**: considered three options — parsing OS
  keychain/credential files, a no-op `claude -p` call, or `claude auth status --json`.
  Went with the last: it's a documented subcommand, costs no tokens, and returns
  instantly, vs. keychain parsing being undocumented/platform-split and a no-op call
  costing real tokens + ~4s latency. Any failure (binary missing, non-zero exit, bad
  JSON) collapses to `false` — one code path covers both "not installed" and "not
  logged in".
- **Prompt-drift risk**: `init` and `app edit` originally risked defining the `app.json`
  question set twice and drifting apart. Extracted `APP_OVERVIEW_FIELDS` into
  `src/commands/app-overview-fields.ts` so both commands share one source — commit
  `8635994`.

# ux-audit CLI

A standalone CLI that walks a web app's user journeys in a real browser and produces a
structured UX audit report — combining Playwright + axe-core (owned directly by this
tool) with an agentic "drive the browser, judge the UX" loop that shells out to the
user's already-authenticated coding CLI (Claude Code by default) instead of calling the
Anthropic API directly.

## Where things are documented

- [`docs/UX_AUDIT_CLI_PLAN.md`](./docs/UX_AUDIT_CLI_PLAN.md) — the design plan:
  architecture decisions and their rationale, tech stack choices, config/data layout,
  execution engine, open risks. Read this before changing architecture, not just the
  code.
- [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — the execution
  checklist, broken into phases with file-level tasks and acceptance criteria. Check
  this before starting work to see what phase is active and what's already done.
- [`reference/ux-audit-skill/`](./reference/ux-audit-skill/) — the prior Claude-Code-native
  markdown skill this CLI supersedes. **Read-only reference**, not part of this tool's
  runtime — its scenario field set, report shape, and executor prompt patterns are the
  behavioral baseline to match or improve on. Do not edit it as part of feature work.

## Conventions

- Every module under `src/` currently exists as a typed stub that throws `not
  implemented — see docs/IMPLEMENTATION_PLAN.md Phase N`. When implementing a phase, replace
  the throw with real logic — don't add new files or restructure unless the plan
  documents call for it.
- `src/config/schema.ts` (zod) is the source of truth for on-disk shapes
  (`config.json`, `app.json`, scenario files, credentials). `src/types/index.ts` mirrors
  it for plain TS types used outside validation boundaries — keep both in sync.
- ESM + `NodeNext` module resolution — relative imports need explicit `.js` extensions
  even though the source files are `.ts`.
- The `LlmBackend` interface (`src/backends/types.ts`) is the seam between the CLI and
  whichever coding CLI drives the browser. Adding Codex/Gemini/API support (Phase 4)
  should mean a new file implementing that interface, not interface changes.
- Run `pnpm typecheck` after changes — the stub pattern above only holds together if
  the whole tree still typechecks.

## Testing interactive (`@clack/prompts`) commands manually

- `tmp/` (gitignored) is scratch space for manually exercising CLI commands against a
  throwaway `.ux-audit/`. `mkdir -p tmp/<case-name>`, `cd` into it, and run the CLI
  directly against that cwd: `(cd tmp/<case-name> && ../../node_modules/.bin/tsx
  ../../src/cli.ts <cmd>)`.
- Piped stdin (`printf '...' | tsx ...`) doesn't work — `@clack/prompts` reads raw
  keypresses from a TTY, not lines. Use `expect` to drive a real pty:
  ```
  spawn ../../node_modules/.bin/tsx ../../src/cli.ts <cmd>
  expect "some prompt text"
  send "\r"          ;# accept the prefilled/default value
  expect eof
  ```
  To edit a prefilled value: `send "\033\[F"` (Home) then repeat `send "\177"`
  (Backspace) enough times to clear it before sending the replacement text.

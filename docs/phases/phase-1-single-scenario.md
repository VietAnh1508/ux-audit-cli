# Phase 1 — Single scenario, fixed W3C guideline, no picker

Status: **in progress** — next up: `src/backends/claude-code.ts` (`runScenario`), and
it's currently blocked on the open spike below. See
[`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) for the checklist and current
overall status; this doc is the detail behind it.

## Plan

Prove the Playwright-CDP-endpoint + `@playwright/mcp` + `claude -p` loop end to end for
exactly one scenario, no picker, no concurrency.

- Scenario file format — markdown, same field set as
  `reference/ux-audit-skill/references/scenario-template.md`, except `Auth` takes a
  `credentialsRef` resolved from `credentials.local.json` instead of an inline
  email/password. Parser lives in `src/config/loader.ts` (`loadScenarios`).
- `src/commands/scenario.ts` (`add`) — copy the template into `.ux-audit/scenarios/`.
- `src/browser/launch.ts` — launch Playwright with a remote-debugging port,
  `checkUrlReachable` preflight.
- `src/browser/mcp-bridge.ts` — spawn `@playwright/mcp` against that CDP endpoint as an
  HTTP-transport subprocess, single `--user-data-dir` for now (no concurrency yet).
- `src/backends/claude-code.ts` (`runScenario`) — spawn `claude -p` with `--mcp-config`
  + an `--allowedTools` allowlist that omits `browser_evaluate` and
  `browser_run_code_unsafe`. Prompt = app overview + scenario steps, writes findings
  JSON to a given path.
- `src/engine/findings-handoff.ts` — read + validate against `ScenarioFindingsSchema`,
  retry once on failure, else surface `Status: ERROR`.
- `src/accessibility/axe-runner.ts` — real `AxeBuilder` scan at each key state,
  `wcag22aa` tags only.
- `src/engine/run-scenario.ts` — wire steps 1-7 together.
- `src/commands/run.ts` — call `run-scenario` for a single resolved scenario (no
  `--scenario` parsing yet).

**Acceptance**: `ux-audit run` against a real local app produces one findings JSON
file with real axe results and at least one LLM-authored finding.

## Testing strategy

Same split as Phase 0: `loadScenarios` is deterministic parsing logic → unit tested.
Everything else in this phase touches a real browser or a real `claude -p` subprocess
— per `UX_AUDIT_CLI_PLAN.md` Decision 7, those are **not** unit tested (mocking a
browser/subprocess would test the mock, not the actual integration risk) and are
instead covered by this phase's manual **Acceptance** check once `run-scenario.ts` is
wired up.

## Testing evidence

- `src/config/loader.test.ts` `describe("loadScenarios", ...)`: 10 cases — empty
  directory, non-markdown files ignored, full field parsing + slug derivation +
  comment stripping, schema defaults when `Auth`/`Output` are unset, friendly errors
  for missing required fields and malformed `## Scenario` sections, sort-by-filename —
  commit `093cd1a`.
- `scenario add` manually exercised via the pty pattern (interactive + direct-argument
  modes, overwrite confirmation) — commit `5161436`.
- `launchBrowser`/`checkUrlReachable`/`startMcpBridge` smoke-tested manually against a
  real local app (see Gotchas below for what that testing surfaced) — commit `3eda4e7`.
- Full Phase 1 **Acceptance** check (real findings JSON with axe + LLM findings) not
  yet run — blocked on `runScenario` and `run-scenario.ts` below.

## Gotchas / drift from plan

- **`--caps` doesn't do what the original plan assumed.** `UX_AUDIT_CLI_PLAN.md`
  described `@playwright/mcp --caps` as how we'd scope out `browser_evaluate`/
  `browser_run_code_unsafe` (RCE prevention). In the installed version (0.0.78),
  `--caps` only *adds* capabilities (`vision`/`pdf`/`devtools`) — it cannot exclude the
  always-on core tools. The exclusion now happens entirely via the backend's
  `--allowedTools` allowlist in `claude-code.ts` instead. Anyone touching MCP bridge
  setup or the allowlist should know this is the *only* enforcement point now — commit
  `3eda4e7`.
- **Open risk, currently blocking `run-scenario.ts`**: the "shared live page" premise
  (our own axe/screenshot code and the LLM backend's MCP tool calls operating on the
  same tab) is not automatic. Smoke-tested three orderings — (a) our own
  `context.newPage()` before the bridge starts, (b) a separate `connectOverCDP` call
  before the bridge starts, (c) attaching via `connectOverCDP` *after* the bridge
  already navigated — and in all three, our Playwright connection's `context.pages()`
  came back empty/stale after `@playwright/mcp` drove a `browser_navigate` over its own
  CDP connection. Two independent `connectOverCDP` clients on the same
  `--remote-debugging-port` do not transparently see each other's pages/contexts by
  default. **Needs a working spike before `run-scenario.ts` is implemented.**
  Candidates: (1) poll/re-query `browser.contexts()`/`Target.getTargets` after the
  bridge acts instead of caching the page reference, (2) drive everything (our axe
  scans included) through the MCP connection's own page handle rather than a second
  Playwright connection, (3) a different CDP attach sequencing entirely. Confirm which
  works before assuming either side can address "the" page — commit `3eda4e7`.

# Phase 1 — Single scenario, fixed W3C guideline, no picker

Status: **in progress** — `src/backends/claude-code.ts` (`runScenario`) is done; next up:
`src/engine/findings-handoff.ts`, then `src/accessibility/axe-runner.ts`.
`src/engine/run-scenario.ts` remains blocked on the open spike below — the adapter itself
never touches a page handle, so it wasn't blocked by it. See
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
  + an `--allowedTools` allowlist scoped to UI-interaction/read-only Playwright MCP
  tools plus `Write` (for the findings handoff). Prompt = app overview + scenario
  steps, writes findings JSON to a given path.
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
- `ClaudeCodeBackend.runScenario` exercised against a real `launchBrowser` +
  `startMcpBridge` pair and a real (non-mocked) `claude -p` subprocess: (1) a flag-level
  smoke test — tool-name prefix, denied-tool behavior, `Write`-tool availability; (2) a
  full call against `https://example.com` (no-auth, `status: "OK"` path) whose output
  findings JSON was validated against `ScenarioFindingsSchema` (`safeParse` →
  `success: true`); (3) a repo-contamination check — ran with cwd set to a scratch dir
  seeded with a marker `CLAUDE.md` and a marker `settings.json` hook standing in for a
  real audited app's repo, confirmed neither leaked into the findings and no
  `.playwright-mcp/` artifacts landed in that directory. **Not exercised**: the
  `authenticated`/`fresh`-with-credentials prompt branches, or the `BLOCKED`/`ERROR`
  status paths — doing so needs a real app + test credentials, which this phase's scope
  (adapter only, no `run-scenario.ts` wiring yet) didn't include. Revisit once
  `run-scenario.ts` exists and there's a real app with an auth flow to point it at.
  `pnpm typecheck` and `pnpm test` (17 tests, pre-existing suite) both clean after these
  changes.
- Full Phase 1 **Acceptance** check (real findings JSON with axe + LLM findings) not
  yet run — still blocked on `run-scenario.ts` below (needs `findings-handoff.ts` and
  `axe-runner.ts` first, then the shared-live-page spike).

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
- **`mcp-bridge.ts` wrote an mcp-config.json that `claude -p` silently ignored.** The
  written config was `{ "mcpServers": { "playwright": { "url": "..." } } }` — missing a
  `"type": "http"` field. `claude --mcp-config` doesn't error on this; it just doesn't
  register the server, so the agent sees no browser tools and reports it has none. Found
  by running `claude mcp add --transport http ... ` once and diffing the resulting entry
  in `~/.claude.json` against what `mcp-bridge.ts` was writing. Fixed in `mcp-bridge.ts`.
- **`--allowedTools` scoping is narrower than "everything except the two RCE tools."**
  The installed `@playwright/mcp` (0.0.78) ships far more tools than the original plan
  language anticipated — cookie/localStorage/sessionStorage/route mocking, tracing,
  video recording, tab management. `claude-code.ts`'s `PLAYWRIGHT_TOOL_NAMES` allowlists
  only the UI-interaction + read-only inspection tools a scenario walk needs, and
  explicitly excludes (beyond `browser_evaluate`/`browser_run_code_unsafe`):
  `browser_tabs`/`browser_close`/`browser_resize` (lifecycle owned by `launch.ts` +
  the engine — the agent touching these would also break the shared-live-page
  invariant above), the storage/cookie/route-mocking tools (would let the agent fake
  auth/session state instead of exercising the real flow under audit), and
  tracing/video/highlight tools (no findings value). See the comment above
  `PLAYWRIGHT_TOOL_NAMES` for the full list.
- **Confirmed empirically (live `claude -p` + real bridge, not from docs):** MCP tool
  names surface to the CLI as `mcp__<server-name>__<tool>` (server name must match the
  `mcpServers` key in the written config, i.e. `mcp__playwright__browser_navigate`); a
  tool call outside `--allowedTools` is denied cleanly in `-p` mode (the model gets a
  rejection message, the process does not hang) — so pre-approval is a real enforcement
  boundary, not just a hint; and `Write` works fine alongside MCP tools in the same
  `--allowedTools` list, confirming the file-based findings handoff the plan calls for
  is viable without loosening the browser tool scope.
- **No `--max-turns` (or equivalent) flag** in the installed `claude` CLI — the
  "iteration/turn cap" mitigation `UX_AUDIT_CLI_PLAN.md` Open risks assumed doesn't
  exist. `claude-code.ts` uses a wall-clock subprocess timeout (`RUN_TIMEOUT_MS`, 10
  minutes) as the runaway guard instead; `--max-budget-usd` exists but is API-key-only,
  not usable for a subscription-auth CLI backend.
- The prompt is passed via **stdin, not argv** — it can embed real login credentials,
  and argv is visible to other processes on the same machine via `ps`.
- **The spawned `claude -p` inherits ambient context from its cwd — and in production
  that cwd is the audited app's own repo**, not something adjacent to it. `claude -p`
  auto-discovers CLAUDE.md/hooks/settings.json starting from cwd and **walks up parent
  directories** looking for them (confirmed: a marker CLAUDE.md two directories above
  cwd still leaked into the response). `--strict-mcp-config` only closes the MCP-server
  hole, not this. Fixed with `--setting-sources ""` — this is the real guard, verified it
  also blocks a project-level hook, not just CLAUDE.md, from a nested cwd — plus running
  the subprocess with `cwd: tmpdir()` as pure extra insurance. Deliberately **not**
  deriving that cwd from `mcpServerConfigPath`/`userDataDir`: per `src/config/paths.ts`
  convention, `userDataDir` lives under the audited repo's own `.ux-audit/`, so it would
  be just as contaminated (discovery walks up) — that would've been a dead defense layer
  wearing a "defense in depth" label. Ruled out `--bare` (forces API-key-only auth,
  breaking the subscription-auth model this backend depends on) and `--safe-mode`
  (disables MCP servers entirely, killing browser tool access). Scope of what
  `--setting-sources ""` was actually verified against: CLAUDE.md and a settings.json
  hook — it closes the primary contamination vectors, not necessarily every one (skills,
  custom agents, and auto-memory are a separate load path and weren't tested).
- **Open item for whoever resolves the shared-live-page spike**: `browser_resize` was
  deliberately excluded from the adapter's allowlist (viewport is meant to be fixed by
  `launchBrowser`'s context, not the agent) — but `launchBrowser` sizes *its own*
  context's page, and the spike above already found that `@playwright/mcp`'s CDP client
  may end up driving a *different* context/page than ours. If that's the case, a
  `mobile` scenario could silently run at desktop width with no way for the agent to
  correct it. Confirm the configured viewport actually reaches the MCP-driven page as
  part of resolving that spike, or `browser_resize` needs to come back into the
  allowlist.

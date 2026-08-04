# Phase 1 — Single scenario, fixed W3C guideline, no picker

**Status:** done — all tasks below implemented, `pnpm typecheck`/`pnpm test` clean, and
the Phase 1 acceptance check passed against a real `claude -p` run. See
[`../../IMPLEMENTATION_PLAN.md`](../../IMPLEMENTATION_PLAN.md) for the checklist and
current overall status across all phases; this doc is the detail behind it.

Prove the Playwright-CDP-endpoint + `@playwright/mcp` + `claude -p` loop end to end for
exactly one scenario, no picker, no concurrency.

**Acceptance**: `ux-audit run` against a real local app produces one findings JSON
file with real axe results and at least one LLM-authored finding.

**Open gaps**: not yet exercised end-to-end — see
[07-run-scenario-engine.md](./07-run-scenario-engine.md)'s Testing evidence for the
full list (auth branches, `BLOCKED`/`ERROR` status paths, the same-origin guard
actually tripping).

## Process diagram

How `ux-audit run` actually executes one scenario — three processes (the CLI, a
Chromium instance, and two short-lived subprocesses), all pivoting around one shared
`Page` object. Numbers match `src/engine/run-scenario.ts`'s call order.

```
┌─ ux-audit CLI process — run.ts → run-scenario.ts ────────────────────────┐
│                                                                          │
│ 1. load config.json / app.json / scenario.md                             │
│ 2. resolveBackend() → backend.isAvailable() preflight                    │
│ 3. checkUrlReachable(scenario.scenarioUrl ?? appOverview.url)             │
│ 4. loadCredentials(scenario.credentialsRef)   — only if Auth is set      │
│                                                                          │
│ 5. launchBrowser(viewport)                                               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─ Chromium — its OWN process, --remote-debugging-port=P ──────────────────┐
│                                                                          │
│ context.newPage()  →  `page`                                             │
│ (created blank — NOT navigated yet; the agent does that in step 7)       │
│                                                                          │
│ ★ this exact Page object is the "shared live page": every later          │
│   step below (7 and 10) drives THIS SAME handle, never a second one      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
   │
   │ same CDP port P, new client
   ▼
┌─ @playwright/mcp — subprocess, spawned by startMcpBridge() ──────────────┐
│                                                                          │
│ 6. --cdp-endpoint http://127.0.0.1:P                                     │
│    connectOverCDP(P) → browser.contexts()[0] == our exact page           │
│    (confirmed empirically — see 03-mcp-bridge.md, "shared-live-page      │
│    spike")                                                               │
│                                                                          │
│    exposes its own HTTP MCP server on port :M                            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
   │
   │ MCP protocol over HTTP:
   │ mcp__playwright__browser_navigate / _click / …
   ▼
┌─ claude -p — subprocess, spawned by backend.runScenario() ───────────────┐
│                                                                          │
│ 7. --mcp-config    → the bridge's :M endpoint                            │
│    --allowedTools  → mcp__playwright__* (UI/read-only only) + Write      │
│                                                                          │
│    walks the scenario's free-text steps, screenshotting at each          │
│    key state, driving ONLY the shared page above via MCP tools           │
│                                                                          │
│    last step: Write findings.json → userDataDir/findings.json            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
   │
   │ claude -p exits
   ▼
┌─ back in the ux-audit CLI process — run-scenario.ts ─────────────────────┐
│                                                                          │
│ 8. readAndValidateFindings(findings.json)                                │
│      invalid? → retry once (re-spawn claude -p, step 7) → else ERROR     │
│                                                                          │
│ 9. same-origin guard: is page.url() still on that resolved URL's origin? │
│      no → ERROR (the shared-page invariant broke)                        │
│                                                                          │
│ 10. runAxeScan(page, ["wcag22aa"])                                       │
│       — direct Playwright call against the SAME page from step 5,        │
│         no subprocess involved this time                                 │
│                                                                          │
│ 11. merge: findings = [...llmFindings, ...axeFindings]                   │
│ 12. cleanup: stopMcpBridge() · browser.close() · rm(userDataDir)         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
   │
   ▼
   <scenario-slug>-findings.json written to disk
```

## Testing strategy

Same split as Phase 0: `loadScenarios` is deterministic parsing logic → unit tested.
Everything else in this phase touches a real browser or a real `claude -p` subprocess
— per `UX_AUDIT_CLI_PLAN.md` Decision 7, those are **not** unit tested (mocking a
browser/subprocess would test the mock, not the actual integration risk) and are
instead covered by this phase's manual acceptance check once `run-scenario.ts` is
wired up.

## Tasks

Status here is a summary — each task file is the authoritative source; update it first,
then this checklist, then `IMPLEMENTATION_PLAN.md`.

- [x] [00-scenario-file-format-and-loader.md](./00-scenario-file-format-and-loader.md)
- [x] [01-scenario-add-command.md](./01-scenario-add-command.md)
- [x] [02-browser-launch.md](./02-browser-launch.md)
- [x] [03-mcp-bridge.md](./03-mcp-bridge.md)
- [x] [04-claude-code-backend-run-scenario.md](./04-claude-code-backend-run-scenario.md)
- [x] [05-findings-handoff.md](./05-findings-handoff.md)
- [x] [06-axe-runner.md](./06-axe-runner.md)
- [x] [07-run-scenario-engine.md](./07-run-scenario-engine.md)
- [x] [08-run-command-single-scenario.md](./08-run-command-single-scenario.md)

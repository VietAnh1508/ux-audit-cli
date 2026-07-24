# Phase 1 — Single scenario, fixed W3C guideline, no picker

Status: **done** — all tasks below implemented, `pnpm typecheck`/`pnpm test` clean, and
the Phase 1 **Acceptance** check passed against a real `claude -p` run. See
[`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) for the checklist and current
overall status; this doc is the detail behind it.

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
│    (confirmed empirically — see Gotchas, "shared-live-page spike")       │
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
- `src/config/loader.ts` (`loadCredentials`) — turned out to be a `run-scenario.ts`
  dependency (step 1's "resolve credentials"), not a separate later task: reads
  `credentials.local.json` (a `credentialsRef -> {email,password}` map, new
  `CredentialsFileSchema` in `config/schema.ts`), with a friendly error naming the
  missing ref if the file or key is absent — the file isn't scaffolded by `init` (it's
  gitignored/user-authored), so it gets its own not-found message rather than the
  generic `readOrThrowInitHint` "run `ux-audit init`" hint other loaders share.

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
  `.playwright-mcp/` artifacts landed in that directory. **Still not exercised**: the
  `authenticated`/`fresh`-with-credentials prompt branches — doing so needs a real app +
  test credentials; the no-auth path is covered by the full Phase 1 acceptance run
  below. `pnpm typecheck` and `pnpm test` (17 tests, pre-existing suite) both clean after
  these changes.
- `readAndValidateFindings` (`src/engine/findings-handoff.ts`): implemented per plan —
  read the findings file, `safeParse` against `ScenarioFindingsSchema`, and on failure
  (missing file, bad JSON, or schema mismatch) re-invoke `backend.runScenario` once with
  `previousValidationError` set (new optional field on `LlmBackendRunOptions`, folded
  into `claude-code.ts`'s prompt as a full re-walk instruction, not a JSON-patch
  instruction — the subprocess is stateless and has no memory of the first attempt). If
  the retry still fails validation, returns a synthesized `{ status: "ERROR" }` findings
  object with the validation error in `notes`, matching the old skill's
  Chrome-unavailable `ERROR` convention referenced in `UX_AUDIT_CLI_PLAN.md` Open risks.
  Not unit tested, matching this phase's testing strategy — the only non-trivial branch
  (the retry) depends on a real backend subprocess, not mockable logic. Exercised
  indirectly via the full acceptance run below (first-attempt success path, i.e. the
  retry branch itself still hasn't been forced/observed live — would need a scenario
  deliberately crafted to make the agent write malformed JSON).
- `runAxeScan` (`src/accessibility/axe-runner.ts`): thin wrapper around
  `@axe-core/playwright`'s `AxeBuilder` — `new AxeBuilder({ page }).withTags(axeTags).analyze()`.
  `AxeScanResult` is now a real type alias for axe-core's `AxeResults` (was `unknown`).
  Not unit tested, matching this phase's testing strategy (real-browser code); exercised
  against a live page via the acceptance run below, and separately against a local
  static page with deliberate violations (missing `alt`, missing `<html lang>`, no
  `<h1>`, etc.) to confirm the axe→`Finding` mapping in `run-scenario.ts` produces
  well-formed output from real violation data — see Gotchas below re: `wcag22aa`'s tag
  scope.
- **Full Phase 1 Acceptance check: passed.** `src/engine/run-scenario.ts` and
  `src/commands/run.ts` implemented and run end-to-end via
  `../../node_modules/.bin/tsx ../../src/cli.ts run` against a scratch `.ux-audit/`
  pointed at `https://example.com` (no-auth, fresh session), with a real, logged-in
  `claude` CLI as the backend. Produced `home-findings.json` with `status: "OK"` and
  three real LLM-authored findings (information density, visual hierarchy, CTA
  clarity) — axe found zero violations for that page under the `wcag22aa` tag filter
  (confirmed separately as a real, not silently-skipped, result — see Gotchas). `pnpm
  typecheck` and `pnpm test` (17 tests) both clean.
- **Not yet exercised end-to-end**: the `authenticated`/`fresh`-with-credentials
  branches (needs a real app with auth), the `BLOCKED`/`ERROR` status paths, and the
  new same-origin shared-page guard actually tripping (needs a scenario where the
  agent's final page genuinely ends up off-origin, e.g. via an OAuth redirect/popup).

## Gotchas / drift from plan

- **`ScenarioFindingsSchema` and `buildPrompt()`'s findings-JSON instructions were
  extended in Phase 2** to add a `screens` array (structured screen-by-screen notes),
  needed once Phase 2's report templates required a real screen-notes section to render
  — not something Phase 1 itself needed. See
  [`phase-2-multi-scenario.md`](./phase-2-multi-scenario.md) Plan, section 3.
- **`--caps` doesn't do what the original plan assumed.** `UX_AUDIT_CLI_PLAN.md`
  described `@playwright/mcp --caps` as how we'd scope out `browser_evaluate`/
  `browser_run_code_unsafe` (RCE prevention). In the installed version (0.0.78),
  `--caps` only *adds* capabilities (`vision`/`pdf`/`devtools`) — it cannot exclude the
  always-on core tools. The exclusion now happens entirely via the backend's
  `--allowedTools` allowlist in `claude-code.ts` instead. Anyone touching MCP bridge
  setup or the allowlist should know this is the *only* enforcement point now — commit
  `3eda4e7`.
- **Shared-live-page spike resolved — the original premise holds, no workaround
  needed.** Re-tested end-to-end against the real (non-mocked) `@playwright/mcp`
  subprocess: `launchBrowser()` creates the context + page (blank, not navigated —
  matching the real flow where the *agent* does the first `browser_navigate`, not us),
  *then* `startMcpBridge()` starts and a real MCP `tools/call browser_navigate` is sent
  over raw HTTP (bypassing `claude -p` — irrelevant here since the server's own
  `ensureTab()` picks the tab, not the client). Result: `@playwright/mcp`'s internal
  `browser.contexts()[0]` (its own `isolated: false` path, since `--cdp-endpoint` is
  set) resolves to our exact context, and its per-session `ensureTab()`/`newTab()`
  adopts our pre-existing page — confirmed by `context.pages().length` staying `1` and
  our original `Page` handle's `.url()` updating to the navigated URL after the tool
  call returns. The configured viewport (1280×800) survives on that same handle too —
  closing the `browser_resize` question below. After killing the bridge subprocess,
  the original `Page` handle remained open and usable (`.title()`, `.screenshot()`) —
  confirming `run-scenario.ts` can hand the exact `page` from `launchBrowser()` straight
  to `runAxeScan()` after `backend.runScenario()` resolves, no second connection or
  polling required. The earlier three-ordering failure (commit `3eda4e7`) was most
  likely masked by the sibling `mcp-config.json` `"type": "http"` bug documented below —
  fixed in the same commit — rather than a real CDP multi-client limitation; not worth
  reproducing further. **Guard added in `run-scenario.ts`**: since this only holds
  because `browser_tabs`/`browser_resize` are excluded from the allowlist (an
  OAuth-popup or similar could still spawn a second page and make `page.url()` stale),
  after `backend.runScenario()` returns with `status: "OK"`, `run-scenario.ts` checks
  `page.url()` is on the resolved URL's (`scenario.scenarioUrl ?? appOverview.url`)
  origin before trusting it for the axe scan —
  if not, the scenario is surfaced as `ERROR` instead of scanning a blank/stale page.
  Not yet exercised against an auth scenario (only the no-auth `example.com`/
  `playwright.dev` case above) — revisit if an auth-flow popup breaks this.
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
- **`browser_resize` exclusion confirmed safe** — the shared-live-page spike above
  verified the configured viewport (1280×800 in that test) reaches the MCP-driven page
  intact (`page.viewportSize()` read back correctly after a real `browser_navigate`),
  since it's the same `Page` object, not a re-created one. `browser_resize` stays out
  of the adapter's allowlist as originally planned.
- **`@axe-core/playwright`'s peer dep resolved to the wrong `playwright-core` by
  default, breaking `Page` type compatibility.** `@playwright/mcp@0.0.78` vendors its
  own alpha `playwright`/`playwright-core` (`1.62.0-alpha-...`), separate from the
  `playwright@1.61.1` this repo depends on directly (the one `launch.ts`'s `Page` type
  comes from). With only `@axe-core/playwright` declared, pnpm resolved its
  `playwright-core: >= 1.0.0` peer dep against that alpha copy instead of `1.61.1`,
  so `runAxeScan`'s `page: Page` parameter (typed via `playwright`) didn't
  structurally match the `Page` type `AxeBuilder`'s constructor expected — a
  `tsc` error, not a runtime one. Fixed by adding explicit `axe-core` and
  `playwright-core` entries (both pinned to what `playwright@1.61.1` already
  resolves to: `axe-core@4.12.1`, `playwright-core@1.61.1`) to `package.json`
  dependencies, which pins pnpm's peer resolution to the matching copy — confirmed via
  `pnpm-lock.yaml` (`@axe-core/playwright: 4.12.1(playwright-core@1.61.1)` after the
  fix, `pnpm typecheck` clean). The mcp package's own alpha `playwright-core` copy is
  still present in `node_modules/.pnpm` (it's an isolated subtree `@playwright/mcp`
  uses for its own subprocess) — it just no longer leaks into our type-checked code.
- **The `w3c` guideline's `wcag22aa`-only axe tag flags almost nothing in practice —
  worth fixing properly in Phase 3, not now.** `wcag22aa` is the *delta* tagset for
  criteria newly added in WCAG 2.2 (a handful of rules like focus-appearance/
  target-size), not "all AA-level rules." Confirmed empirically: a local static page
  with deliberate `image-alt`, `html-has-lang`, `page-has-heading-one`, and
  `color-contrast` violations scored **zero** violations under `--tags wcag22aa` but
  **six** under no tag filter — so `init.ts`'s current `{ name: "w3c", axeTags:
  ["wcag22aa"] }` (Phase 0) under-covers what most people mean by "WCAG AA compliance."
  Left as-is for Phase 1 (guideline *content* is explicitly Phase 3's job, and changing
  it now would mean redefining what "w3c" means without the presets/custom-checklist
  machinery Phase 3 is scoped to add) — but Phase 3 should combine `wcag2a` + `wcag2aa`
  + `wcag21aa` + `wcag22aa` (the full AA baseline through 2.2) for a preset actually
  meant to represent AA compliance, not just the 2.2 delta.
- **Live progress log added to `ClaudeCodeBackend.runScenario`** — the subprocess used
  to run with `stdio: ["pipe", "ignore", "pipe"]` (stdout deliberately unconsumed, since
  findings go to a file, not stdout), which left the terminal blank for the full
  multi-minute scenario walk. Switched to `--output-format stream-json --verbose`
  (confirmed empirically: `claude -p --output-format stream-json` errors without
  `--verbose`) piped through a small NDJSON line-buffering logger
  (`createStreamJsonLogger`/`logStreamEvent`) that prints each `assistant` message's
  `text`/`tool_use` content blocks live, plus a one-line `result` summary at the end.
  This also incidentally fixes the old deadlock risk the "ignore" comment called out
  (an unconsumed pipe filling its OS buffer) — the logger now actively drains stdout.
  `run-scenario.ts` also gained its own `→ ...` progress lines around the parts that
  aren't part of the LLM subprocess at all (opening the browser, starting the bridge,
  running the axe scan, cleanup), so nothing is silent end-to-end. Exercised against a
  real `claude -p` run — output looked like:
  ```
  → Opening browser (desktop)...
  → Starting the accessibility bridge...
  → Auditing in progress — claude-code is walking the scenario...
    🔧 browser_navigate({"url":"https://example.com"})
    🔧 browser_take_screenshot({"type":"png",...})
    💬 Completed the walkthrough of example.com...
    ✓ claude -p finished in 55.3s
  → Running accessibility scan...
  ```
  **Side discovery from having this visibility at all**: in that same run, the agent
  also attempted several `Bash`/`Read`/`ToolSearch` tool calls (not in `ALLOWED_TOOLS`)
  trying to locate and re-read its own screenshot file after `browser_take_screenshot`,
  before eventually finding it and proceeding — these are denied cleanly (per the
  existing "denied tool doesn't hang" finding above) so the run still succeeded, but
  it's wasted turns that were completely invisible before this logging existed.
- **Root-caused and fixed the wasted-`Read` churn above — it was also silently causing
  real timeouts on larger apps.** A user's own multi-page scenario
  (`fresh-visitor-walkthrough`, ~15 pages/tabs across a real Next.js app) failed with
  `claude -p exited with code 143`. Two compounding bugs, both fixed:
  1. **Root cause**: read `@playwright/mcp`'s `browser_take_screenshot` handler
     (`coreBundle.js`) — it only returns the image inline (viewable by the model,
     `registerImageResult`) when called with **no** `filename` argument; passing
     `filename` saves to disk instead (`addFileResult`) and the model gets no image
     data back. The agent was passing a `filename` on every call (to be "organized"),
     then trying to `Read` the file to actually see it — denied every time, since
     `Read` isn't in `ALLOWED_TOOLS`. One wasted turn per screenshot, and a 15-page
     walkthrough takes a lot of screenshots. Fixed in `buildPrompt()`
     (`claude-code.ts`): explicitly tell the agent to omit `filename` (image comes
     back inline that way) and added a "don't try to read screenshots back, you have
     no file access" guardrail to the prompt's "Do not" list.
  2. **Symptom-side bug**: confirmed empirically (`node -e` spawning a real `claude -p`
     with a 3s Node `timeout`) that when Node's `spawn(..., {timeout})` kills the child
     with SIGTERM, `claude` catches it and exits with **code 143** — the `close` event
     reports `code: 143, signal: null`, never `signal: "SIGTERM"`. The old handler only
     checked `if (signal)`, so a real `RUN_TIMEOUT_MS` timeout surfaced as the
     unhelpful "claude -p exited with code 143" with no hint it was a timeout. Fixed:
     `if (signal || code === 143)` now catches both, with a message naming
     `RUN_TIMEOUT_MS` and suggesting raising it if a scenario legitimately needs longer.
  3. **Verified fix**: re-ran the exact same scenario end-to-end against the real app
     after both fixes. Zero denied `Read` calls across the entire walk (previously one
     per screenshot); `claude -p finished in 446.5s` (~7.4 min, comfortably under the
     10-minute `RUN_TIMEOUT_MS`) with `status: "OK"` and 10 real, specific LLM findings
     covering every nav tab plus the account menu. The old run, by contrast, was only
     partway through the walk (signin/champion) by the ~4-minute mark before eventually
     hitting the timeout. Axe found zero violations again under the narrow `wcag22aa`
     tag filter — consistent with the gotcha above, not a new issue.

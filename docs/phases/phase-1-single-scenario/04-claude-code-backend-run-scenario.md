# Task: `src/backends/claude-code.ts` (`runScenario`)

**Phase:** [1 — Single scenario, fixed W3C guideline, no picker](./overview.md)
**Status:** done

## Plan

`src/backends/claude-code.ts` (`runScenario`) — spawn `claude -p` with `--mcp-config`
+ an `--allowedTools` allowlist scoped to UI-interaction/read-only Playwright MCP
tools plus `Write` (for the findings handoff). Prompt = app overview + scenario
steps, writes findings JSON to a given path.

## Implementation log

Exercised against a real `launchBrowser` + `startMcpBridge` pair (see
[02-browser-launch.md](./02-browser-launch.md) and [03-mcp-bridge.md](./03-mcp-bridge.md))
and a real (non-mocked) `claude -p` subprocess throughout — per the phase's testing
strategy, this is real-browser/real-subprocess code, not unit tested.

## Testing evidence

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
  test credentials; the no-auth path is covered by the full Phase 1 acceptance run (see
  [08-run-command-single-scenario.md](./08-run-command-single-scenario.md)). `pnpm
  typecheck` and `pnpm test` (17 tests, pre-existing suite) both clean after these
  changes.

## Gotchas / drift from plan

- **`--allowedTools` scoping is narrower than "everything except the two RCE tools."**
  The installed `@playwright/mcp` (0.0.78) ships far more tools than the original plan
  language anticipated — cookie/localStorage/sessionStorage/route mocking, tracing,
  video recording, tab management. `claude-code.ts`'s `PLAYWRIGHT_TOOL_NAMES` allowlists
  only the UI-interaction + read-only inspection tools a scenario walk needs, and
  explicitly excludes (beyond `browser_evaluate`/`browser_run_code_unsafe`):
  `browser_tabs`/`browser_close`/`browser_resize` (lifecycle owned by `launch.ts` +
  the engine — the agent touching these would also break the shared-live-page
  invariant, see [03-mcp-bridge.md](./03-mcp-bridge.md)), the storage/cookie/route-mocking
  tools (would let the agent fake auth/session state instead of exercising the real flow
  under audit), and tracing/video/highlight tools (no findings value). See the comment
  above `PLAYWRIGHT_TOOL_NAMES` for the full list.
- **Confirmed empirically (live `claude -p` + real bridge, not from docs):** MCP tool
  names surface to the CLI as `mcp__<server-name>__<tool>` (server name must match the
  `mcpServers` key in the written config, i.e. `mcp__playwright__browser_navigate`); a
  tool call outside `--allowedTools` is denied cleanly in `-p` mode (the model gets a
  rejection message, the process does not hang) — so pre-approval is a real enforcement
  boundary, not just a hint; and `Write` works fine alongside MCP tools in the same
  `--allowedTools` list, confirming the file-based findings handoff (see
  [05-findings-handoff.md](./05-findings-handoff.md)) is viable without loosening the
  browser tool scope.
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
  custom agents, and auto-memory are a separate load path and weren't tested). Phase 2's
  `synthesizeReport` (see
  [`phase-2-multi-scenario/02-report-data-model-and-synthesis-backend.md`](../phase-2-multi-scenario/02-report-data-model-and-synthesis-backend.md))
  reuses this exact `--setting-sources ""` + `cwd: tmpdir()` pair rather than
  re-deriving it.
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
  `run-scenario.ts` (see [07-run-scenario-engine.md](./07-run-scenario-engine.md)) also
  gained its own `→ ...` progress lines around the parts that aren't part of the LLM
  subprocess at all (opening the browser, starting the bridge, running the axe scan,
  cleanup), so nothing is silent end-to-end. Exercised against a real `claude -p` run —
  output looked like:
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
     tag filter — consistent with [06-axe-runner.md](./06-axe-runner.md)'s gotcha, not a
     new issue.

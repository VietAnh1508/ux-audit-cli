# Task: `src/engine/run-scenario.ts`

**Phase:** [1 — Single scenario, fixed W3C guideline, no picker](./overview.md)
**Status:** done

## Plan

`src/engine/run-scenario.ts` — wire steps 1-7 together (see the phase overview's
process diagram for the full call order this orchestrates across the CLI process,
Chromium, and the two short-lived subprocesses).

- `src/config/loader.ts` (`loadCredentials`) — turned out to be a `run-scenario.ts`
  dependency (step 1's "resolve credentials"), not a separate later task: reads
  `credentials.local.json` (a `credentialsRef -> {email,password}` map, new
  `CredentialsFileSchema` in `config/schema.ts`), with a friendly error naming the
  missing ref if the file or key is absent — the file isn't scaffolded by `init` (it's
  gitignored/user-authored), so it gets its own not-found message rather than the
  generic `readOrThrowInitHint` "run `ux-audit init`" hint other loaders share.

## Implementation log

Wires together scenario loading, backend resolution/preflight, URL reachability,
credential loading, browser launch, the MCP bridge, `backend.runScenario()`, the
findings handoff, and the axe scan — real-browser/real-subprocess orchestration, not
unit tested per the phase's testing strategy.

## Testing evidence

Exercised end-to-end via the full Phase 1 acceptance run — see
[08-run-command-single-scenario.md](./08-run-command-single-scenario.md).

**Not yet exercised end-to-end**: the `authenticated`/`fresh`-with-credentials
branches (needs a real app with auth), the `BLOCKED`/`ERROR` status paths, and the
same-origin shared-page guard below actually tripping (needs a scenario where the
agent's final page genuinely ends up off-origin, e.g. via an OAuth redirect/popup).

## Gotchas / drift from plan

- **Same-origin shared-page guard** — added because the shared-live-page invariant
  (see [03-mcp-bridge.md](./03-mcp-bridge.md)) only holds while `browser_tabs`/
  `browser_resize` stay excluded from the backend's allowlist; an OAuth-popup or
  similar could still spawn a second page and make `page.url()` stale. After
  `backend.runScenario()` returns with `status: "OK"`, `run-scenario.ts` checks
  `page.url()` is on the resolved URL's (`scenario.scenarioUrl ?? appOverview.url`)
  origin before trusting it for the axe scan — if not, the scenario is surfaced as
  `ERROR` instead of scanning a blank/stale page. See
  [03-mcp-bridge.md](./03-mcp-bridge.md) for the spike that motivated this.
- **Own `→ ...` progress lines** added around the parts of the flow that aren't the LLM
  subprocess itself (opening the browser, starting the bridge, running the axe scan,
  cleanup) — see [04-claude-code-backend-run-scenario.md](./04-claude-code-backend-run-scenario.md)'s
  "Live progress log" gotcha for the paired change on the subprocess-output side and
  the full example output.

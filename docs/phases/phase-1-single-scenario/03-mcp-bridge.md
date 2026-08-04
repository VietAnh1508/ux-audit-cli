# Task: `src/browser/mcp-bridge.ts`

**Phase:** [1 — Single scenario, fixed W3C guideline, no picker](./overview.md)
**Status:** done

## Plan

`src/browser/mcp-bridge.ts` — spawn `@playwright/mcp` against that CDP endpoint as an
HTTP-transport subprocess, single `--user-data-dir` for now (no concurrency yet).

## Implementation log

Real-subprocess code — not unit tested per the phase's testing strategy, smoke-tested
manually against a real local app alongside [02-browser-launch.md](./02-browser-launch.md).

## Testing evidence

- `startMcpBridge` smoke-tested manually against a real local app (see Gotchas below
  for what that testing surfaced) — commit `3eda4e7`.

## Gotchas / drift from plan

- **`--caps` doesn't do what the original plan assumed.** `UX_AUDIT_CLI_PLAN.md`
  described `@playwright/mcp --caps` as how we'd scope out `browser_evaluate`/
  `browser_run_code_unsafe` (RCE prevention). In the installed version (0.0.78),
  `--caps` only *adds* capabilities (`vision`/`pdf`/`devtools`) — it cannot exclude the
  always-on core tools. The exclusion now happens entirely via the backend's
  `--allowedTools` allowlist instead (see
  [04-claude-code-backend-run-scenario.md](./04-claude-code-backend-run-scenario.md)) —
  anyone touching MCP bridge setup or the allowlist should know this is the *only*
  enforcement point now — commit `3eda4e7`.
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
  see [02-browser-launch.md](./02-browser-launch.md)'s `browser_resize` gotcha. After
  killing the bridge subprocess, the original `Page` handle remained open and usable
  (`.title()`, `.screenshot()`) — confirming `run-scenario.ts` can hand the exact `page`
  from `launchBrowser()` straight to `runAxeScan()` after `backend.runScenario()`
  resolves, no second connection or polling required. The earlier three-ordering
  failure (commit `3eda4e7`) was most likely masked by the sibling `mcp-config.json`
  `"type": "http"` bug documented below — fixed in the same commit — rather than a real
  CDP multi-client limitation; not worth reproducing further. **Guard added in
  `run-scenario.ts`** (see
  [07-run-scenario-engine.md](./07-run-scenario-engine.md)): since this only holds
  because `browser_tabs`/`browser_resize` are excluded from the allowlist (an
  OAuth-popup or similar could still spawn a second page and make `page.url()` stale),
  after `backend.runScenario()` returns with `status: "OK"`, `run-scenario.ts` checks
  `page.url()` is on the resolved URL's (`scenario.scenarioUrl ?? appOverview.url`)
  origin before trusting it for the axe scan — if not, the scenario is surfaced as
  `ERROR` instead of scanning a blank/stale page. Not yet exercised against an auth
  scenario (only the no-auth `example.com`/`playwright.dev` case above) — revisit if an
  auth-flow popup breaks this.
- **`mcp-bridge.ts` wrote an mcp-config.json that `claude -p` silently ignored.** The
  written config was `{ "mcpServers": { "playwright": { "url": "..." } } }` — missing a
  `"type": "http"` field. `claude --mcp-config` doesn't error on this; it just doesn't
  register the server, so the agent sees no browser tools and reports it has none. Found
  by running `claude mcp add --transport http ...` once and diffing the resulting entry
  in `~/.claude.json` against what `mcp-bridge.ts` was writing. Fixed in `mcp-bridge.ts`.

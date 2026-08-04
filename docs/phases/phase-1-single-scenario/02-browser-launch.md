# Task: `src/browser/launch.ts`

**Phase:** [1 — Single scenario, fixed W3C guideline, no picker](./overview.md)
**Status:** done

## Plan

`src/browser/launch.ts` — launch Playwright with a remote-debugging port,
`checkUrlReachable` preflight.

## Implementation log

Real-browser code — not unit tested per the phase's testing strategy, smoke-tested
manually against a real local app instead, alongside
[03-mcp-bridge.md](./03-mcp-bridge.md) since the two were exercised together.

## Testing evidence

- `launchBrowser`/`checkUrlReachable` smoke-tested manually against a real local app
  (see Gotchas below, and [03-mcp-bridge.md](./03-mcp-bridge.md) for the mcp-bridge
  half of the same smoke test) — commit `3eda4e7`.

## Gotchas / drift from plan

- **`browser_resize` exclusion confirmed safe** — the shared-live-page spike
  (documented in [03-mcp-bridge.md](./03-mcp-bridge.md)) verified the configured
  viewport (1280×800 in that test) reaches the MCP-driven page intact
  (`page.viewportSize()` read back correctly after a real `browser_navigate`), since
  it's the same `Page` object, not a re-created one. `browser_resize` stays out of the
  backend's `--allowedTools` allowlist as originally planned — see
  [04-claude-code-backend-run-scenario.md](./04-claude-code-backend-run-scenario.md).

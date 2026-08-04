# Task: Concurrency

**Phase:** [2 — Multi-scenario + picker + report synthesis + concurrency](./overview.md)
**Status:** done

## Plan

- Add `p-limit` as a real dependency (not currently in `package.json`) rather than
  hand-rolling a semaphore — small, mature, does exactly this.
- `run.ts` resolves the backend **once** up front (`resolveBackend` + `isAvailable`
  preflight) instead of once per scenario, and passes that resolved `backend` into
  `runScenario` as a new parameter — small signature change to
  `src/engine/run-scenario.ts` (currently re-resolves internally). Avoids N redundant
  `claude auth status` shellouts and gives synthesis (see
  [02-report-data-model-and-synthesis-backend.md](./02-report-data-model-and-synthesis-backend.md))
  the same backend instance.
- `const limit = pLimit(Number(options.concurrency) || config.concurrency)`, map
  selected scenarios through `limit(() => runScenarioSafely(...))`, `Promise.all`.
- **No new isolation work needed for concurrency itself** — `launchBrowser()` already
  grabs a fresh free port per call and `mcp-bridge.ts` already gets its own free port +
  unique `mkdtemp` `userDataDir` per scenario (Phase 1 built this in without realizing
  it'd be load-bearing for Phase 2). Confirm this holds under real concurrent load as
  part of this phase's acceptance check, but no plumbing changes expected.
- `runScenario` already returns `{status: "ERROR", ...}` findings rather than throwing
  on most failure paths — but wrap each pooled call in try/catch anyway (export
  `errorFindings` from `run-scenario.ts`) so one scenario's unexpected exception can't
  reject the whole `Promise.all` and lose the other scenarios' results.

## Implementation log

`run.ts` pools selected scenarios through `pLimit(...)`, wrapping each pooled call in
try/catch (`errorFindings`, now exported from `run-scenario.ts`) so one scenario's
unexpected throw can't reject the whole `Promise.all` and lose the other scenarios'
results — matching the plan exactly. The backend-resolve-once part was done even
earlier: `run.ts` calls `resolveBackend` + `isAvailable` once up front and passes the
resolved `backend` into `runScenario`, which dropped its own internal resolve/preflight
(and the now-unused `config` parameter) accordingly. Selecting N scenarios today runs
up to `--concurrency` (or `config.concurrency` if the flag is omitted) at a time and
produces N independent findings files, then synthesizes and writes one combined report
(see [04-run-command-wiring.md](./04-run-command-wiring.md)).

Reusable fixtures for the manual concurrency check live in `test/manual/` —
`test/manual/concurrent-run-scenario.ts` runs N scenarios through the real
`runScenario()` with a fake `LlmBackend` so no LLM cost is incurred.

## Testing evidence

- Manually verified via `test/manual/concurrent-run-scenario.ts`: 5 scenarios through
  the real `runScenario()` (real `launchBrowser()` + real `startMcpBridge()`
  subprocesses, fake `LlmBackend` so no LLM cost) at `--concurrency 2`. All 5 completed
  with no port or `userDataDir` collisions and the active-scenario counter peaked at
  exactly 2, confirming the plan's "no new isolation work needed" prediction under real
  concurrent load. Also verified the `--concurrency`/`config.concurrency` fallback
  logic directly (no flag falls back to config value; non-positive, non-numeric, and
  zero flag values all fall back to config rather than being passed to `pLimit` as-is).
  `pnpm typecheck` and `pnpm test` clean (56 tests passing).

## Gotchas / drift from plan

- **`--concurrency` lost its commander-level default** (`"2"` → none) so the fallback
  to `config.concurrency` in `const limit = pLimit(...)` can actually be reached —
  commander bakes a string default straight into `options.concurrency`, so
  `Number(options.concurrency) || config.concurrency` as originally planned would never
  fall through to the config value (it'd always see `"2"`). `run.ts` now treats an
  absent/non-positive/non-numeric `--concurrency` the same way (falls back to
  `config.concurrency`, which already has its own `.default(2)` in the zod schema)
  rather than trusting `Number(...) || ...` alone.
- **Concurrency plumbing (free ports, `userDataDir`) verified under real concurrent
  load, per the plan's acceptance note.** `test/manual/concurrent-run-scenario.ts` runs
  5 fake scenarios through the real `runScenario()` (real `launchBrowser()` + real
  `startMcpBridge()` subprocesses) at `--concurrency 2`, with a fake `LlmBackend` that
  never actually drives the page (so every scenario ends `ERROR` at the same-origin
  guard — expected and asserted on) — isolating the concurrency plumbing from any real
  LLM cost. Result: no port or `userDataDir` collisions across the run, and the
  active-scenario counter never exceeded the configured limit of 2. No plumbing changes
  were needed, confirming the plan's prediction.

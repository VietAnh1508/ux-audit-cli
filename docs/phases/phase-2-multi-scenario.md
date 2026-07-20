# Phase 2 — Multi-scenario + picker + report synthesis + concurrency

Status: **not started**. See [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) for
current overall status.

## Plan

- `src/commands/run.ts` — parse `--scenario a,b`; no flag → `@clack/prompts`
  multi-select checkbox over `loadScenarios()`.
- Concurrency: run scenarios via a bounded pool (`--concurrency`, default 2 per
  `UX_AUDIT_CLI_PLAN.md` Open risks), each with its own `--isolated` (or distinct
  `--user-data-dir`) MCP bridge instance and CDP port.
- `src/report/synthesize.ts` — LLM call over all scenarios' findings JSON + `app.json`,
  cross-scenario dedup by element+dimension, returns `Report`.
- `src/report/render.ts` — `Report` → markdown using
  `src/report/templates/{report-single,report-multi}.md`.

**Acceptance**: `ux-audit run` with 3 scenarios (2 passing, 1 seeded to fail) produces
one combined report with a correctly deduped cross-scenario section, respects
`--concurrency`.

## Testing strategy

`report/render.ts` is pure templating logic → unit tested (per `UX_AUDIT_CLI_PLAN.md`
Decision 7). Concurrency, isolated browser profiles, and `synthesize.ts`'s LLM call are
covered by this phase's manual **Acceptance** check instead.

## Testing evidence

_Not started._

## Gotchas / drift from plan

_None yet — record deviations from the plan above as they're discovered, the way
Phase 1 records the `--caps` and shared-page-handle findings._

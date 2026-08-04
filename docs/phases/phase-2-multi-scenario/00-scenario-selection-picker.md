# Task: Scenario selection — `src/commands/run.ts`

**Phase:** [2 — Multi-scenario + picker + report synthesis + concurrency](./overview.md)
**Status:** done

## Plan

- `--scenario a,b`: split on comma, trim, validate each slug against `loadScenarios()`.
  Unknown slugs → error listing exactly which ones aren't found (not a generic failure).
- No `--scenario`, exactly 1 scenario on disk → run it immediately (Phase 1 behavior,
  unchanged).
- No `--scenario`, 0 scenarios → error (unchanged).
- No `--scenario`, >1 scenarios → `@clack/prompts` `multiselect` checkbox over
  `loadScenarios()`, one line per scenario reusing `formatScenarioSummary`-style detail
  (slug + viewport + session + auth) from `commands/scenario.ts`. Cancelled picker or
  empty selection → exit 1, same `exitOnCancel` pattern already used in
  `commands/scenario.ts`.

## Implementation log

Implemented as planned. See Gotchas for the one deviation the `@clack/prompts`
`multiselect` API forced.

## Testing evidence

- Manually exercised against a scratch `.ux-audit/` with 3 scenarios: `--scenario
  a,b,c` with an unknown slug mixed in (errors listing exactly the unknown ones),
  `--scenario` containing only commas/whitespace (errors, doesn't silently no-op),
  `--scenario a,b` end-to-end (both run sequentially, each writes its own
  `<slug>-findings.json`), no-`--scenario` with exactly one scenario on disk (runs
  immediately, no prompt), no-`--scenario` with >1 on disk both cancelling the picker
  and submitting an empty selection (both exit 1). `pnpm typecheck` and `pnpm test`
  clean.

## Gotchas / drift from plan

- **Picker option labels can't reuse `formatScenarioSummary` as-is.** That helper
  returns a two-line string (`slug\n  details`) meant for `scenario list`'s plain
  console output. Passing it straight to `@clack/prompts` `multiselect` as an option
  `label` embeds a raw newline inside the box-drawing UI and corrupts the rendered
  list. Fixed by splitting `formatScenarioSummary` into `formatScenarioDetail`
  (single-line details, no slug) + `formatScenarioSummary` (composes the two-line
  version for `scenario list`), and having the `run` picker use
  `{label: scenario.slug, hint: formatScenarioDetail(scenario)}` instead — `hint`
  renders inline next to the focused option, which is what `multiselect` actually
  supports for secondary detail text.
- **This section landed ahead of concurrency** (see
  [01-concurrency-pool.md](./01-concurrency-pool.md)) — both are now done.

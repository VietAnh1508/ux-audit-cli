# Task: Scenario file format + `loadScenarios`

**Phase:** [1 — Single scenario, fixed W3C guideline, no picker](./overview.md)
**Status:** done

## Plan

Scenario file format — markdown, same field set as
`reference/ux-audit-skill/references/scenario-template.md`, except `Auth` takes a
`credentialsRef` resolved from `credentials.local.json` instead of an inline
email/password. Parser lives in `src/config/loader.ts` (`loadScenarios`).

## Implementation log

Deterministic parsing logic → unit tested per the phase's TDD strategy (same split as
Phase 0's `config/loader.ts` work).

## Testing evidence

- `src/config/loader.test.ts` `describe("loadScenarios", ...)`: 10 cases — empty
  directory, non-markdown files ignored, full field parsing + slug derivation +
  comment stripping, schema defaults when `Auth`/`Output` are unset, friendly errors
  for missing required fields and malformed `## Scenario` sections, sort-by-filename —
  commit `093cd1a`.

## Gotchas / drift from plan

- **`ScenarioFindingsSchema` and `buildPrompt()`'s findings-JSON instructions were
  extended in Phase 2** to add a `screens` array (structured screen-by-screen notes),
  needed once Phase 2's report templates required a real screen-notes section to render
  — not something this task itself needed. See
  [`phase-2-multi-scenario/02-report-data-model-and-synthesis-backend.md`](../phase-2-multi-scenario/02-report-data-model-and-synthesis-backend.md)
  for the retroactive schema change.

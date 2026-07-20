# Phase 3 — Guideline presets + custom rules

Status: **not started**. See [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) for
current overall status.

## Plan

- `src/config/loader.ts` (`loadGuideline`) + `.ux-audit/guidelines/*.json` — built-ins
  `w3c` (`wcag22aa`), `us-section508`, `eu-en301549`, each just a different axe
  `runOnly` tag set (see `UX_AUDIT_CLI_PLAN.md` Decision 3).
- `src/commands/guideline.ts` (`list`, `add`) — list built-ins + custom, `add` for
  user-defined tag sets / checklists.
- `--guideline` flag on `run` wired through to `axe-runner.ts`.

**Acceptance**: switching `--guideline us-section508` changes which axe rules run,
verified against a page with a known Section 508-only violation.

## Testing strategy

`loadGuideline` is deterministic parsing/validation → unit tested, same pattern as
`loadConfig`/`loadScenarios`. The `--guideline` → `axe-runner.ts` wiring needs a real
browser page → covered by this phase's manual **Acceptance** check instead.

## Testing evidence

_Not started._

## Gotchas / drift from plan

_None yet._

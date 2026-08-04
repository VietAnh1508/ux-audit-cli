# Phase 3 — Guideline presets + custom rules

**Status:** not started. See [`../../IMPLEMENTATION_PLAN.md`](../../IMPLEMENTATION_PLAN.md)
for current overall status across all phases.

## Plan

- `src/config/loader.ts` (`loadGuideline`) + `.ux-audit/guidelines/*.json` — built-ins
  `w3c` (`wcag22aa`), `us-section508`, `eu-en301549`, each just a different axe
  `runOnly` tag set (see `UX_AUDIT_CLI_PLAN.md` Decision 3). See
  [`phase-1-single-scenario/06-axe-runner.md`](../phase-1-single-scenario/06-axe-runner.md)
  Gotchas: the current `w3c` preset's `wcag22aa`-only tag set is the WCAG 2.2 *delta*,
  not the full AA baseline — this phase's `w3c` preset should combine `wcag2a` +
  `wcag2aa` + `wcag21aa` + `wcag22aa` instead.
- `src/commands/guideline.ts` (`list`, `add`) — list built-ins + custom, `add` for
  user-defined tag sets / checklists.
- `--guideline` flag on `run` wired through to `axe-runner.ts`.

**Acceptance**: switching `--guideline us-section508` changes which axe rules run,
verified against a page with a known Section 508-only violation.

## Testing strategy

`loadGuideline` is deterministic parsing/validation → unit tested, same pattern as
`loadConfig`/`loadScenarios`. The `--guideline` → `axe-runner.ts` wiring needs a real
browser page → covered by this phase's manual acceptance check instead.

## Tasks

Not yet broken down into task files — this phase hasn't started. Create task files
(same shape as Phase 0-2's) as work on each Plan bullet begins, rather than
scaffolding empty "_Not started._" files ahead of time.

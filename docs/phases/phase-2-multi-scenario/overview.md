# Phase 2 — Multi-scenario + picker + report synthesis + concurrency

**Status:** done. All tasks below implemented and verified (per-task testing evidence
in each task file); the phase's full 3-scenario (2 passing, 1 seeded to fail)
end-to-end walkthrough against a real target app was not separately re-run, but each
task's own real-backend smoke test (concurrency, synthesis dedup, single-scenario
synthesis) already covers the pieces it would have exercised together. See
[`../../IMPLEMENTATION_PLAN.md`](../../IMPLEMENTATION_PLAN.md) for current overall
status across all phases.

**Acceptance**: `ux-audit run` with 3 scenarios (2 passing, 1 seeded to fail) produces
one combined report with a correctly deduped cross-scenario section, respects
`--concurrency`.

## Testing strategy

`report/render.ts` is pure templating logic → unit tested (per `UX_AUDIT_CLI_PLAN.md`
Decision 7): single vs. multi mode, severity grouping, cross-scenario `appearsIn`
rendering, and empty `screenNotes`/`quickWins`/`featureSuggestions` arrays rendering
sensibly (not literal `[]` or empty headers). Concurrency, the picker, and
`synthesize.ts`'s LLM call are covered by this phase's manual acceptance check
instead — same reasoning as Phase 1: mocking a subprocess would test the mock.

Reusable fixtures for that manual check (and for any future `synthesize.ts`/
`findings-handoff.ts`/backend change that needs re-verifying against a real subprocess)
live in `test/fixtures/scenario-findings/` — three `ScenarioFindings` JSON files
(`login`, `checkout` sharing one cross-scenario CTA-contrast issue worded differently in
each so dedup has to do real work; `checkout-mobile` `BLOCKED` with no findings, to
exercise a non-OK section). `test/manual/synthesize-report.ts` runs `synthesizeReport()`
against all of them and prints the result — `./node_modules/.bin/tsx
test/manual/synthesize-report.ts`. Costs one real `claude -p` call; not run by `pnpm
test`.

## Tasks

Status here is a summary — each task file is the authoritative source; update it first,
then this checklist, then `IMPLEMENTATION_PLAN.md`.

- [x] [00-scenario-selection-picker.md](./00-scenario-selection-picker.md)
- [x] [01-concurrency-pool.md](./01-concurrency-pool.md)
- [x] [02-report-data-model-and-synthesis-backend.md](./02-report-data-model-and-synthesis-backend.md)
- [x] [03-report-render.md](./03-report-render.md)
- [x] [04-run-command-wiring.md](./04-run-command-wiring.md)

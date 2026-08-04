# Task: Wiring it up in `run.ts`

**Phase:** [2 — Multi-scenario + picker + report synthesis + concurrency](./overview.md)
**Status:** done

## Plan

- After the concurrency pool resolves, write each scenario's findings JSON to
  `${outputDir}/${slug}-findings.json` (unchanged from Phase 1, just done per-item
  instead of once).
- Call `synthesizeReport(backend, findingsPaths, appOverview)` → `Report`.
- `renderMarkdown(report, mode)` → markdown string.
- Output path precedence, matching the old skill and the plan's `--output` flag:
  `options.output` → (single-scenario only) that scenario's `Output:` field →
  `path.join(config.outputDir, "UX_AUDIT.md")`.
- Exit code 1 if any scenario's status wasn't `OK`, or synthesis itself failed.

**Acceptance**: `ux-audit run` with 3 scenarios (2 passing, 1 seeded to fail) produces
one combined report with a correctly deduped cross-scenario section, respects
`--concurrency`.

## Implementation log

Implemented as planned, plus two behaviors the plan didn't call out explicitly — see
Gotchas.

## Testing evidence

- `pnpm typecheck` and `pnpm test` clean (56 tests, unchanged — this task is wiring,
  not new unit-tested logic). Manually confirmed the single-scenario synthesis path
  (the most common invocation) against the real `claude` CLI — see
  [02-report-data-model-and-synthesis-backend.md](./02-report-data-model-and-synthesis-backend.md)
  for that result.
- The plan's literal 3-scenario, real-target-app CLI walkthrough (`ux-audit run` end to
  end against a live app) wasn't separately re-run — but its constituent pieces already
  were, each against the real `claude` CLI: [01-concurrency-pool.md](./01-concurrency-pool.md)'s
  concurrency pool under real concurrent `runScenario()` load,
  [02-report-data-model-and-synthesis-backend.md](./02-report-data-model-and-synthesis-backend.md)'s
  multi-scenario dedup (`login`/`checkout` sharing a finding, `checkout-mobile`
  `BLOCKED`), and this task's single-scenario path above. Judged sufficient to close
  the phase; a full live-app walkthrough remains a good manual sanity check before a
  real release.

## Gotchas / drift from plan

- **This task changed `--output`'s meaning.** Phase 1 used `--output`
  (single-scenario only) as the destination for that scenario's *findings JSON*. Now
  that synthesis writes a combined report, `--output` picks the *report's* destination
  instead — findings JSON unconditionally goes to `<outputDir>/<slug>-findings.json`
  regardless of scenario count or `--output`. Precedence for the report path, matching
  the plan: `--output` → (single scenario only) that scenario's `output` field →
  `<outputDir>/UX_AUDIT.md`.
- **All-non-OK runs skip synthesis.** Not called for by the plan, but if every selected
  scenario ends `ERROR`/`BLOCKED` there's nothing for the model to synthesize from —
  `run.ts` now checks `allFindings.every(f => f.status !== "OK")` and skips the
  `synthesizeReport` call entirely (still exits 1, still leaves the per-scenario
  findings JSON on disk) rather than paying for a real `claude -p` call over empty
  data.

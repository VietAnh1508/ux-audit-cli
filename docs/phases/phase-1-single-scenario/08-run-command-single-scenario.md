# Task: `src/commands/run.ts` (single scenario, no picker)

**Phase:** [1 — Single scenario, fixed W3C guideline, no picker](./overview.md)
**Status:** done

## Plan

`src/commands/run.ts` — call `run-scenario` for a single resolved scenario (no
`--scenario` parsing yet).

**Acceptance**: `ux-audit run` against a real local app produces one findings JSON
file with real axe results and at least one LLM-authored finding.

## Implementation log

Thin CLI entry point over [07-run-scenario-engine.md](./07-run-scenario-engine.md) —
no picker or multi-scenario logic yet (that's Phase 2).

## Testing evidence

- **Full Phase 1 Acceptance check: passed.** `run-scenario.ts` and `run.ts`
  implemented and run end-to-end via `../../node_modules/.bin/tsx ../../src/cli.ts run`
  against a scratch `.ux-audit/` pointed at `https://example.com` (no-auth, fresh
  session), with a real, logged-in `claude` CLI as the backend. Produced
  `home-findings.json` with `status: "OK"` and three real LLM-authored findings
  (information density, visual hierarchy, CTA clarity) — axe found zero violations for
  that page under the `wcag22aa` tag filter (confirmed separately as a real, not
  silently-skipped, result — see
  [06-axe-runner.md](./06-axe-runner.md) Gotchas). `pnpm typecheck` and `pnpm test`
  (17 tests) both clean.

## Gotchas / drift from plan

N/A

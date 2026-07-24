# ux-audit CLI — Implementation Plan

**Status: Phase 1 — `src/engine/run-scenario.ts` and `src/commands/run.ts` done, both
exercised against a real `claude -p` run. Phase 1 acceptance check passed — see
[`phases/phase-1-single-scenario.md`](./phases/phase-1-single-scenario.md#testing-evidence).
Next: Phase 2.**
(update this line in the same commit as whatever task you just closed out)

This is the execution checklist. For *why* each decision was made, see
[`UX_AUDIT_CLI_PLAN.md`](./UX_AUDIT_CLI_PLAN.md) — that file is the source of truth for
architecture and rationale. Each phase's file-level task list, testing evidence, and
any drift/gotchas discovered while implementing it live in `docs/phases/phase-N-*.md` —
this file just tracks the checklist and current status at a glance.

`reference/ux-audit-skill/` is the old Claude-Code-native skill, kept **read-only** for
behavioral parity — its scenario field set, report shape, and executor prompt patterns
are the baseline this CLI should match or improve on, not reinvent from scratch.

## Repo layout

```
src/
  cli.ts                  — commander entry point
  commands/                — one file per subcommand, registers on the shared program
    init.ts
    app.ts
    scenario.ts
    guideline.ts
    run.ts
  config/
    schema.ts              — zod schemas (source of truth for on-disk shapes)
    paths.ts                — .ux-audit/* path resolution
    loader.ts                — read + validate config.json / app.json / scenarios / credentials
  backends/
    types.ts                — LlmBackend adapter interface
    claude-code.ts           — v1 backend
    codex.ts, gemini-cli.ts, api.ts — phase 4 stubs
    resolve.ts               — "auto" backend resolution
  browser/
    launch.ts                — Playwright + CDP endpoint
    mcp-bridge.ts             — @playwright/mcp subprocess bridge
  accessibility/
    axe-runner.ts             — AxeBuilder wrapper
  engine/
    run-scenario.ts           — per-scenario orchestration (steps 1-7)
    findings-handoff.ts        — file-based findings read/validate/retry
  report/
    schema.ts                 — structured Report zod schema
    synthesize.ts              — LLM-based cross-scenario synthesis
    render.ts                  — Report -> markdown
    templates/                 — copied from reference/ux-audit-skill/assets/
  types/index.ts              — shared TS types (mirrors config/schema.ts)
```

Everything above already exists as a stub (throws `not implemented — see
IMPLEMENTATION_PLAN.md Phase N`) and typechecks (`pnpm typecheck`). The phases below
fill them in, in order — each phase should leave `pnpm typecheck` clean and the
stated acceptance check passing before moving to the next.

## Testing strategy

See `UX_AUDIT_CLI_PLAN.md` Decision 7 for the rationale. TDD: `vitest` was set up as
the very first Phase 0 task, before `config/loader.ts` or any other stub got real
logic — write the failing test first, then implement against it. Only
`config/schema.ts`, `config/paths.ts`, `config/loader.ts`, `backends/resolve.ts`, and
`report/render.ts` get unit tests — everything that needs a real browser or a real CLI
subprocess is verified by each phase's manual **Acceptance** check instead, not mocked.

## Phases

Each phase's detail doc has four sections: **Plan** (the task list and acceptance
criterion as scoped for that phase), **Testing strategy**, **Testing evidence** (what
was actually run/verified, with commit references), and **Gotchas / drift from plan**
(corrections and open risks discovered while implementing, so the next session doesn't
rediscover them). Update the relevant phase doc, not just the checklist below, when you
close out a task.

- [x] **Phase 0 — Scaffolding & preflight** — done.
      → [`phases/phase-0-scaffolding.md`](./phases/phase-0-scaffolding.md)
- [x] **Phase 1 — Single scenario, fixed W3C guideline, no picker** — done.
      → [`phases/phase-1-single-scenario.md`](./phases/phase-1-single-scenario.md)
  - [x] Scenario file format + `loadScenarios`
  - [x] `src/commands/scenario.ts` (`add`)
  - [x] `src/browser/launch.ts`
  - [x] `src/browser/mcp-bridge.ts`
  - [x] `src/backends/claude-code.ts` (`runScenario`)
  - [x] `src/engine/findings-handoff.ts`
  - [x] `src/accessibility/axe-runner.ts`
  - [x] `src/engine/run-scenario.ts`
  - [x] `src/commands/run.ts` (single scenario, no picker)
- [ ] **Phase 2 — Multi-scenario + picker + report synthesis + concurrency** — not started.
      → [`phases/phase-2-multi-scenario.md`](./phases/phase-2-multi-scenario.md)
  - [ ] `src/config/schema.ts` / `types/index.ts` — `ScreenNoteSchema`,
        `ScenarioFindingsSchema.screens` (retroactive Phase 1 extension)
  - [ ] `src/backends/claude-code.ts` — `buildPrompt()` screen-notes instructions,
        `synthesizeReport()` implementation + signature change
  - [ ] `src/engine/findings-handoff.ts` — generalize read/validate/retry for reuse by
        report synthesis
  - [ ] `src/report/schema.ts` — `CrossScenarioFindingSchema`, extended `ReportSchema`
        (executive summary, quick wins, feature suggestions, screen notes)
  - [ ] `src/report/synthesize.ts` (`synthesizeReport`)
  - [ ] `src/report/render.ts` (`renderMarkdown`, single + multi mode) — unit tested
  - [ ] `src/engine/run-scenario.ts` — accept a pre-resolved `backend` param
  - [ ] `src/commands/run.ts` — `--scenario` parsing, multi-select picker, `p-limit`
        concurrency pool, output wiring
  - [ ] `package.json` — add `p-limit` dependency
- [ ] **Phase 3 — Guideline presets + custom rules** — not started.
      → [`phases/phase-3-guideline-presets.md`](./phases/phase-3-guideline-presets.md)
- [ ] **Phase 4 — Additional LLM backends** — not started.
      → [`phases/phase-4-additional-backends.md`](./phases/phase-4-additional-backends.md)
- [ ] **Phase 5 — Polish, distribution, docs** — not started.
      → [`phases/phase-5-polish.md`](./phases/phase-5-polish.md)

## Open questions carried from the design plan

See `UX_AUDIT_CLI_PLAN.md` → **Open risks** for the full list (interactive-login
requirement, snapshot-driven login limits, structured-output conformance, concurrent
browser profiles, subscription rate-limit ceilings). Re-check each before closing the
phase it affects.

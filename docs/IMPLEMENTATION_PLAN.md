# ux-audit CLI — Implementation Plan

**Active phase: Phase 3 — Guideline presets + custom rules (not started).** Phases 0-2
are done — scaffolding/preflight, single-scenario execution end to end (Playwright CDP
+ `@playwright/mcp` + `claude -p`), and multi-scenario picker + report synthesis +
concurrency. Phase 5's packaging half (tarball build, release automation) was pulled
forward and is also done — see
[`phases/phase-5-polish/overview.md`](./phases/phase-5-polish/overview.md). See the
Phases table below for links to each phase's detail.
(update this line in the same commit as whatever task you just closed out)

This is the high-level progress tracker: project overview, which phase is active, and
links to each phase's detail. For _why_ each architecture decision was made, see
[`UX_AUDIT_CLI_PLAN.md`](./UX_AUDIT_CLI_PLAN.md) — that file is the source of truth for
architecture and rationale.

Each phase is broken into task files, one per unit of work, under
`docs/phases/phase-N-<slug>/`:

- `overview.md` — that phase's task list + status, shared testing strategy, and
  acceptance criterion. Check this before starting work on a phase.
- `NN-<task-name>.md` — one task, with **Plan** (the original scope, user-story style),
  **Implementation log** (what was actually built), **Testing evidence** (what was
  actually run/verified, with commit references), and **Gotchas / drift from plan**
  (corrections and open risks discovered while implementing, so the next session
  doesn't rediscover them).

**Status ownership**: the task file is authoritative. Update it first when you close
out a task or hit something that deviates from the plan; update the phase's
`overview.md` checklist second; update this file's "Active phase" line and the Phases
table third. Create a phase's task files only once work on that phase actually starts —
don't scaffold empty ones ahead of time.

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

Everything above started out as a typed stub (throws `not implemented — see
IMPLEMENTATION_PLAN.md Phase N`); modules not yet reached by an active phase (Phase 3+)
still throw. The phases below fill them in, in order — each phase should leave `pnpm
typecheck` clean and the stated acceptance check passing before moving to the next.

## Testing strategy

See `UX_AUDIT_CLI_PLAN.md` Decision 7 for the rationale. TDD: `vitest` was set up as
the very first Phase 0 task, before `config/loader.ts` or any other stub got real
logic — write the failing test first, then implement against it. Only
`config/schema.ts`, `config/paths.ts`, `config/loader.ts`, `backends/resolve.ts`, and
`report/render.ts` get unit tests — everything that needs a real browser or a real CLI
subprocess is verified by each phase's manual acceptance check instead, not mocked.

## Phases

- [x] **Phase 0 — Scaffolding & preflight** — done.
      → [`phases/phase-0-scaffolding/overview.md`](./phases/phase-0-scaffolding/overview.md)
- [x] **Phase 1 — Single scenario, fixed W3C guideline, no picker** — done.
      → [`phases/phase-1-single-scenario/overview.md`](./phases/phase-1-single-scenario/overview.md)
- [x] **Phase 2 — Multi-scenario + picker + report synthesis + concurrency** — done.
      → [`phases/phase-2-multi-scenario/overview.md`](./phases/phase-2-multi-scenario/overview.md)
- [ ] **Phase 3 — Guideline presets + custom rules** — not started.
      → [`phases/phase-3-guideline-presets/overview.md`](./phases/phase-3-guideline-presets/overview.md)
- [ ] **Phase 4 — Additional LLM backends** — not started.
      → [`phases/phase-4-additional-backends/overview.md`](./phases/phase-4-additional-backends/overview.md)
- [ ] **Phase 5 — Polish, distribution, docs** — partially done (packaging pulled
      forward; README/error-audit/npm-publish still open).
      → [`phases/phase-5-polish/overview.md`](./phases/phase-5-polish/overview.md)

## Open questions carried from the design plan

See `UX_AUDIT_CLI_PLAN.md` → **Open risks** for the full list (interactive-login
requirement, snapshot-driven login limits, structured-output conformance, concurrent
browser profiles, subscription rate-limit ceilings). Re-check each before closing the
phase it affects.

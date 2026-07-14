# ux-audit CLI

A standalone CLI that walks a web app's user journeys in a real browser and produces a
structured UX audit report — combining Playwright + axe-core with an agentic loop that
shells out to an already-authenticated coding CLI (Claude Code by default) to judge UX.

This is a placeholder. The full README (quick start, requirements, scenario format) is
scoped for Phase 5, once the command surface stops changing — see
[`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md).

## Where to start

- [`docs/UX_AUDIT_CLI_PLAN.md`](./docs/UX_AUDIT_CLI_PLAN.md) — architecture decisions and rationale.
- [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — phased execution checklist; check this for current status.
- [`CLAUDE.md`](./CLAUDE.md) — conventions for working in this repo.

## Local setup

```
pnpm install
pnpm typecheck
pnpm dev -- --help
```

Every subcommand currently throws `not implemented` — that's the intended Phase 0 stub
state, not a bug. See `IMPLEMENTATION_PLAN.md` for what's done and what's next.

Playwright browser binaries are not yet installed in this environment; run
`pnpm exec playwright install` before any work that actually launches a browser (Phase 1+).

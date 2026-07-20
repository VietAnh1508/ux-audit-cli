# Phase 5 — Polish, distribution, docs

Status: **not started**. See [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) for
current overall status.

## Plan

- `npx ux-audit-cli` works from a clean install (verify `bin` entry + `dist/` build).
- `README.md` (quick start, requirements, scenario format) — not yet written; write
  once the command surface has stopped changing.
- Error messages audit — every thrown error in the stubs above should have been
  replaced with a user-facing message, not a raw exception.

**Acceptance**: a clean-machine `npx ux-audit-cli init && ux-audit-cli run` walkthrough
works end to end using only the published README.

## Testing strategy

All manual — this phase is verifying distribution/UX polish, not adding new
deterministic logic to unit test.

## Testing evidence

_Not started._

## Gotchas / drift from plan

_None yet._

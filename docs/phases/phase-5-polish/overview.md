# Phase 5 — Polish, distribution, docs

**Status:** partially done — packaging pulled forward. See
[00-teammate-test-build-and-release-automation.md](./00-teammate-test-build-and-release-automation.md)
(done) and [01-readme-and-distribution-polish.md](./01-readme-and-distribution-polish.md)
(not started, the rest of this phase's original scope). See
[`../../IMPLEMENTATION_PLAN.md`](../../IMPLEMENTATION_PLAN.md) for current overall
status across all phases.

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

## Tasks

Status here is a summary — each task file is the authoritative source; update it first,
then this checklist, then `IMPLEMENTATION_PLAN.md`.

- [x] [00-teammate-test-build-and-release-automation.md](./00-teammate-test-build-and-release-automation.md) —
      pulled forward, done
- [ ] [01-readme-and-distribution-polish.md](./01-readme-and-distribution-polish.md) —
      not started

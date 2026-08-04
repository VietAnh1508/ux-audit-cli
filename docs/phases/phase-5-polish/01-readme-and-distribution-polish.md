# Task: README, error-message audit, npm publish

**Phase:** [5 — Polish, distribution, docs](./overview.md)
**Status:** not started

## Plan

- `npx ux-audit-cli` works from a clean install (verify `bin` entry + `dist/` build).
- `README.md` (quick start, requirements, scenario format) — not yet written; write
  once the command surface has stopped changing.
- Error messages audit — every thrown error in the stubs above should have been
  replaced with a user-facing message, not a raw exception.

**Acceptance**: a clean-machine `npx ux-audit-cli init && ux-audit-cli run` walkthrough
works end to end using only the published README.

Note: the packaging half of Phase 5's original scope (tarball build, release
automation) has already been done — see
[00-teammate-test-build-and-release-automation.md](./00-teammate-test-build-and-release-automation.md).
This task is the remainder: the actual README, the error-message pass, and publishing
to the npm registry.

## Testing strategy

All manual — this task is verifying distribution/UX polish, not adding new
deterministic logic to unit test.

## Testing evidence

_Not started._

## Gotchas / drift from plan

N/A

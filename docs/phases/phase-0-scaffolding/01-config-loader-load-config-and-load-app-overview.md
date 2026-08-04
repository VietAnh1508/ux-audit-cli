# Task: `config/loader.ts` — `loadConfig` / `loadAppOverview`

**Phase:** [0 — Scaffolding & preflight](./overview.md)
**Status:** done

## Plan

`src/config/loader.ts` (`loadConfig`, `loadAppOverview`) — real fs read + zod
validation, friendly "run `ux-audit init` first" error instead of raw ENOENT/zod
error. `loadScenarios`/`loadCredentials`/`loadGuideline` stay stubs (later phases).

## Implementation log

Implemented as deterministic, pure-logic code per the phase overview's TDD strategy —
tests written before the implementation.

## Testing evidence

- `src/config/loader.test.ts`: 8 cases for `loadConfig`/`loadAppOverview` against real
  temp directories (friendly-error paths for missing `.ux-audit/`, invalid JSON, failed
  zod validation; schema-defaults and explicit-value paths for both loaders) — commit
  `18a82bf`.

## Gotchas / drift from plan

N/A

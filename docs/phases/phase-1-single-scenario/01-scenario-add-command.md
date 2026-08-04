# Task: `ux-audit scenario add`

**Phase:** [1 — Single scenario, fixed W3C guideline, no picker](./overview.md)
**Status:** done

## Plan

`src/commands/scenario.ts` (`add`) — copy the template into `.ux-audit/scenarios/`.

## Implementation log

Interactive `@clack/prompts` flow (plus a direct-argument mode) — verified manually,
same pty pattern as Phase 0's `init`/`app edit`.

## Testing evidence

- Manually exercised via the pty pattern (interactive + direct-argument modes,
  overwrite confirmation) — commit `5161436`.

## Gotchas / drift from plan

N/A

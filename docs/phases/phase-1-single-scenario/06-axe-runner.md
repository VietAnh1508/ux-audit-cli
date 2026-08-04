# Task: `src/accessibility/axe-runner.ts`

**Phase:** [1 — Single scenario, fixed W3C guideline, no picker](./overview.md)
**Status:** done

## Plan

`src/accessibility/axe-runner.ts` — real `AxeBuilder` scan at each key state,
`wcag22aa` tags only.

## Implementation log

Thin wrapper around `@axe-core/playwright`'s `AxeBuilder` —
`new AxeBuilder({ page }).withTags(axeTags).analyze()`. `AxeScanResult` is now a real
type alias for axe-core's `AxeResults` (was `unknown`).

## Testing evidence

Not unit tested, matching this phase's testing strategy (real-browser code); exercised
against a live page via the acceptance run (see
[08-run-command-single-scenario.md](./08-run-command-single-scenario.md)), and
separately against a local static page with deliberate violations (missing `alt`,
missing `<html lang>`, no `<h1>`, etc.) to confirm the axe→`Finding` mapping in
`run-scenario.ts` produces well-formed output from real violation data — see Gotchas
below re: `wcag22aa`'s tag scope.

## Gotchas / drift from plan

- **`@axe-core/playwright`'s peer dep resolved to the wrong `playwright-core` by
  default, breaking `Page` type compatibility.** `@playwright/mcp@0.0.78` vendors its
  own alpha `playwright`/`playwright-core` (`1.62.0-alpha-...`), separate from the
  `playwright@1.61.1` this repo depends on directly (the one `launch.ts`'s `Page` type
  comes from). With only `@axe-core/playwright` declared, pnpm resolved its
  `playwright-core: >= 1.0.0` peer dep against that alpha copy instead of `1.61.1`,
  so `runAxeScan`'s `page: Page` parameter (typed via `playwright`) didn't
  structurally match the `Page` type `AxeBuilder`'s constructor expected — a
  `tsc` error, not a runtime one. Fixed by adding explicit `axe-core` and
  `playwright-core` entries (both pinned to what `playwright@1.61.1` already
  resolves to: `axe-core@4.12.1`, `playwright-core@1.61.1`) to `package.json`
  dependencies, which pins pnpm's peer resolution to the matching copy — confirmed via
  `pnpm-lock.yaml` (`@axe-core/playwright: 4.12.1(playwright-core@1.61.1)` after the
  fix, `pnpm typecheck` clean). The mcp package's own alpha `playwright-core` copy is
  still present in `node_modules/.pnpm` (it's an isolated subtree `@playwright/mcp`
  uses for its own subprocess) — it just no longer leaks into our type-checked code.
- **The `w3c` guideline's `wcag22aa`-only axe tag flags almost nothing in practice —
  worth fixing properly in Phase 3, not now.** `wcag22aa` is the *delta* tagset for
  criteria newly added in WCAG 2.2 (a handful of rules like focus-appearance/
  target-size), not "all AA-level rules." Confirmed empirically: a local static page
  with deliberate `image-alt`, `html-has-lang`, `page-has-heading-one`, and
  `color-contrast` violations scored **zero** violations under `--tags wcag22aa` but
  **six** under no tag filter — so `init.ts`'s current `{ name: "w3c", axeTags:
  ["wcag22aa"] }` (Phase 0) under-covers what most people mean by "WCAG AA compliance."
  Left as-is for Phase 1 (guideline *content* is explicitly Phase 3's job, and changing
  it now would mean redefining what "w3c" means without the presets/custom-checklist
  machinery Phase 3 is scoped to add) — but see
  [`phase-3-guideline-presets/overview.md`](../phase-3-guideline-presets/overview.md):
  Phase 3 should combine `wcag2a` + `wcag2aa` + `wcag21aa` + `wcag22aa` (the full AA
  baseline through 2.2) for a preset actually meant to represent AA compliance, not just
  the 2.2 delta.

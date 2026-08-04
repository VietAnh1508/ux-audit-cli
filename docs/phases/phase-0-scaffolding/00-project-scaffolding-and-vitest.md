# Task: Project scaffolding + vitest setup

**Phase:** [0 — Scaffolding & preflight](./overview.md)
**Status:** done

## Plan

Set up the repo shell so every later phase has something typed to fill in, and a test
runner ready before any of it gets real logic:

- `package.json`, `tsconfig.json`, `.gitignore`, `src/` skeleton — all modules present
  as typed stubs (`throw new Error("not implemented — see IMPLEMENTATION_PLAN.md Phase N")`).
- `vitest` wired up first, before any stub gets real logic (TDD — see the phase
  overview's Testing strategy), no test files yet at this point.
- Playwright browser binaries (`pnpm exec playwright install`) confirmed as a one-time
  per-machine step, not covered by `pnpm install` — documented in `README.md`, not
  auto-installed by `ux-audit init`.

## Implementation log

Scaffolded `package.json`/`tsconfig.json`/`.gitignore` and the full `src/` module tree
(see `IMPLEMENTATION_PLAN.md`'s Repo layout) as typed stubs. Wired up `vitest` as the
test runner before writing any real logic anywhere in the tree.

## Testing evidence

- `pnpm test` (vitest) passing on an empty suite — commit `92334e0`.
- Playwright chromium install verified with a real `chromium.launch()` smoke test —
  commit `31172d6`.

## Gotchas / drift from plan

- **Editor false positives, not a real bug**: `tsc --noEmit` was clean but the VS Code
  editor showed spurious type errors. Root cause was the editor using a different
  TypeScript version than the project's. Fixed by pinning the workspace TS version via
  `.vscode/settings.json` — commit `18a82bf`. Worth knowing if a future session sees
  editor errors that `pnpm typecheck` doesn't reproduce.

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

- **Teammate test build (pulled forward, done).** The full Phase 5 acceptance criterion
  below (clean-machine `npx ux-audit-cli` walkthrough via the published README) is still
  not started — but a teammate needed something installable before that, so the
  packaging half was pulled forward on its own:
  - `package.json` gained `"files": ["dist"]`, `"scripts.prepare": "tsc -p ."`,
    `"scripts.pack": "pnpm build && npm pack"`, `"private": true` (blocks accidental
    `npm publish` before this phase deliberately does that — doesn't block `npm pack` or
    tarball installs), and a version bump to `0.1.0-beta.1` (semver prerelease, bump the
    trailing number each time a new build goes out) so re-shared builds are
    identifiable.
  - Distribution mechanism is a **pre-built tarball**, not a git-URL install.
  - **`npm install -g github:VietAnh1508/ux-audit-cli` does not work — don't re-attempt
    this without addressing the root cause.** Verified against npm 11.18.0: npm's
    git-dependency install flow places the root package and immediately runs its
    `prepare` script *before* installing that package's own `devDependencies` (confirmed
    via `.npm/_logs`), so `prepare: "tsc -p ."` fails with `sh: tsc: command not found`
    (exit 127). A tarball install never runs `prepare` at all (npm assumes a packed
    tarball is already built), which is why that path works instead.
  - **Cutting a release is automated via `.github/workflows/release-beta.yml`,
    triggered by pushing a `v*` tag** (never on every push to `main` — the version bump
    is still a deliberate local step):
    ```
    npm version prerelease --preid=beta --no-git-tag-version
    git commit -am "chore: release v$(node -p "require('./package.json').version")"
    git tag "v$(node -p "require('./package.json').version")"
    git push origin main "v$(node -p "require('./package.json').version")"
    ```
    (`git push --follow-tags` looks like it should work here but doesn't — it only
    pushes *annotated* tags, and `git tag` without `-a` makes a lightweight one, so the
    tag silently never reaches GitHub. Push it explicitly, as above — confirmed by
    hitting this exact silent failure while verifying the pipeline end to end for
    `v0.1.0-beta.2`.)

    The workflow checks the pushed tag matches `package.json`'s version (fails fast if
    you forgot to bump), runs `typecheck` + `test`, builds, packs, and publishes a
    GitHub Release with the tarball attached under a **fixed asset name**
    (`ux-audit-cli.tgz`, not npm's default `ux-audit-cli-<version>.tgz`). That fixed name
    is what makes the teammate's install command permanent:
    ```
    npm install -g https://github.com/VietAnh1508/ux-audit-cli/releases/latest/download/ux-audit-cli.tgz
    ```
    Same command re-installs to pick up every future beta; `ux-audit --version` shows
    which one actually landed. One deliberate trade-off: GitHub's `/releases/latest`
    alias only resolves to releases *not* flagged `prerelease` in GitHub's own release
    metadata (separate from the `-beta.N` semver string) — the workflow does not pass
    `--prerelease` to `gh release create`, on purpose, since every release cut right now
    is "the current thing to test." Revisit if this ever needs a separate stable channel.
  - Teammate prerequisites are now in `README.md`'s "Beta builds" section: Node ≥ 20, an
    already-authenticated `claude` CLI on PATH (see the ENOENT/not-logged-in handling in
    `src/backends/claude-code.ts`), and `npx playwright install chromium` run once after
    installing — Playwright's browser binaries are a separate download and this repo's
    `pnpm-workspace.yaml` `allowBuilds` allowlist doesn't cover Playwright's postinstall,
    so don't rely on it firing automatically.
  - What's actually testable right now: `init`/`app`/`scenario`/`run` for a **single**
    scenario (Phase 1). Multi-scenario picker works but the combined report + concurrency
    pool are still open Phase 2 items — tell the teammate to expect that edge to be
    rough. `guideline` (Phase 3) and the codex/gemini/api backends (Phase 4) are
    intentionally unimplemented stubs, not bugs to report.
  - Still explicitly open for this phase, not covered by the above: the real
    `README.md`, the error-message audit, and actually publishing to the npm registry.

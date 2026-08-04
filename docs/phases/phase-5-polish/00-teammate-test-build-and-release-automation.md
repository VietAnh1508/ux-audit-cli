# Task: Teammate test build + release automation (pulled forward)

**Phase:** [5 — Polish, distribution, docs](./overview.md)
**Status:** done

This work was pulled forward from Phase 5's original scope — a teammate needed
something installable before the rest of Phase 5 (README, error-message audit, npm
publish) was ready, so the packaging half was done on its own. See
[01-readme-and-distribution-polish.md](./01-readme-and-distribution-polish.md) for
what's still open.

## Plan

Not separately planned ahead of time — scoped and built in response to the immediate
need for a teammate-installable build, using the packaging pieces the eventual Phase 5
acceptance criterion (`npx ux-audit-cli` from a clean install) will also need.

## Implementation log

- `package.json` gained `"files": ["dist"]`, `"scripts.prepare": "tsc -p ."`,
  `"scripts.pack": "pnpm build && npm pack"`, `"private": true` (blocks accidental
  `npm publish` before Phase 5 deliberately does that — doesn't block `npm pack` or
  tarball installs), and a version bump to `0.1.0-beta.1` (semver prerelease, bump the
  trailing number each time a new build goes out) so re-shared builds are
  identifiable.
- Distribution mechanism is a **pre-built tarball**, not a git-URL install.
- Cutting a release is automated via `.github/workflows/release-beta.yml`, triggered by
  pushing a `v*` tag (never on every push to `main` — the version bump is still a
  deliberate local step). See `CLAUDE.md`'s "Cutting a beta release" section for the
  exact commands.
- The workflow checks the pushed tag matches `package.json`'s version (fails fast if
  you forgot to bump), runs `typecheck` + `test`, builds, packs, and publishes a
  GitHub Release with the tarball attached under a **fixed asset name**
  (`ux-audit-cli.tgz`, not npm's default `ux-audit-cli-<version>.tgz`). That fixed name
  is what makes the teammate's install command permanent:
  ```
  npm install -g https://github.com/VietAnh1508/ux-audit-cli/releases/latest/download/ux-audit-cli.tgz
  ```
  Same command re-installs to pick up every future beta; `ux-audit --version` shows
  which one actually landed.
- Teammate prerequisites are now in `README.md`'s "Beta builds" section: Node ≥ 20, an
  already-authenticated `claude` CLI on PATH (see the ENOENT/not-logged-in handling in
  `src/backends/claude-code.ts`), and `npx playwright install chromium` run once after
  installing — Playwright's browser binaries are a separate download and this repo's
  `pnpm-workspace.yaml` `allowBuilds` allowlist doesn't cover Playwright's postinstall,
  so don't rely on it firing automatically.

## Testing evidence

- Verified the full tag-push → GitHub Release pipeline end to end for `v0.1.0-beta.2`
  (see Gotchas for the silent-failure this surfaced and fixed).
- What's actually testable right now via this build: `init`/`app`/`scenario`/`run` for
  a **single** scenario (Phase 1). Multi-scenario picker works but the combined report
  + concurrency pool were still open Phase 2 items at the time this build went out —
  Phase 2 has since closed, see
  [`../phase-2-multi-scenario/overview.md`](../phase-2-multi-scenario/overview.md).
  `guideline` (Phase 3) and the codex/gemini/api backends (Phase 4) are intentionally
  unimplemented stubs, not bugs to report.

## Gotchas / drift from plan

- **`npm install -g github:VietAnh1508/ux-audit-cli` does not work — don't re-attempt
  this without addressing the root cause.** Verified against npm 11.18.0: npm's
  git-dependency install flow places the root package and immediately runs its
  `prepare` script *before* installing that package's own `devDependencies` (confirmed
  via `.npm/_logs`), so `prepare: "tsc -p ."` fails with `sh: tsc: command not found`
  (exit 127). A tarball install never runs `prepare` at all (npm assumes a packed
  tarball is already built), which is why that path works instead.
- **`git push --follow-tags` looks like it should work but doesn't** — it only pushes
  *annotated* tags, and `git tag` without `-a` makes a lightweight one, so the tag
  silently never reaches GitHub and the workflow never fires. Push it explicitly
  instead (see `CLAUDE.md`) — confirmed by hitting this exact silent failure while
  verifying the pipeline end to end for `v0.1.0-beta.2`.
- **One deliberate trade-off**: GitHub's `/releases/latest` alias only resolves to
  releases *not* flagged `prerelease` in GitHub's own release metadata (separate from
  the `-beta.N` semver string) — the workflow does not pass `--prerelease` to `gh
  release create`, on purpose, since every release cut right now is "the current thing
  to test." Revisit if this ever needs a separate stable channel.

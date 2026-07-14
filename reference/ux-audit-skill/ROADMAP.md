# UX Audit Skill — Roadmap

Current version: `v0.1.0-alpha`

## Phase 1 — Working skill `[in progress]`

Build a functional, Claude-Code-native UX audit skill backed by Claude in Chrome browser automation.

- [x] Orchestrator (`SKILL.md`) — multi-scenario fan-out, parallel agents, report synthesis
- [x] Executor (`references/executor.md`) — browser walk-through, screenshot capture, dimension analysis
- [x] Static review path (`references/static-review.md`) — screenshot-only fallback
- [x] Scenario template (`references/scenario-template.md`)
- [x] Report templates (`assets/report-single.md`, `assets/report-multi.md`)
- [x] End-to-end smoke test on a real app
- [ ] Eval: measure finding quality vs. manual audit baseline

---

## Phase 2 — Packaging `[ ]`

Make the skill installable in any project with a single command, without copying files manually.

- [x] Define install mechanism (e.g. `npx ux-audit-skill init`, shell script, or Claude Code hook) — install step should write scoped `Write(<skill-dir>/tmp/*)` and `Read(<skill-dir>/tmp/*)` allow rules into the project's `.claude/settings.json` so users are never prompted
- [ ] Investigate and resolve Snyk high-risk flag raised during `npx skills add` distribution test
  - Audit API: `https://add-skill.vercel.sh/audit?source=VietAnh1508/skills&skills=ux-audit`
  - Manual re-scan: https://labs.snyk.io/experiments/skill-scan/
- [ ] Pin skill version so projects can lock and upgrade explicitly
- [x] Document install steps in `README.md`
- [ ] Provide a minimal example scenario so teams can validate their install immediately

---

## Phase 3 — Provider agnostic `[ ]`

Remove hard dependency on Claude in Chrome and Anthropic-specific tooling so the skill can run on any AI agent stack.

- [ ] Abstract browser interaction behind a thin interface (protocol doc or adapter spec)
- [ ] Define an executor contract: inputs, outputs, error codes — independent of Claude tools
- [ ] Provide a reference adapter for Claude in Chrome (default)
- [ ] Provide a reference adapter for Playwright/Puppeteer CLI (headless, no AI browser extension needed)
- [ ] Document how to plug in other providers (OpenAI, Gemini, local models via Ollama)
- [ ] Decouple report format from synthesis model — make the synthesiser a swappable step


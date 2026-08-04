# Phase 4 — Additional LLM backends

**Status:** not started. See [`../../IMPLEMENTATION_PLAN.md`](../../IMPLEMENTATION_PLAN.md)
for current overall status across all phases.

## Plan

One backend at a time, each a new MCP-config writer + subprocess shape behind the
existing `LlmBackend` interface — no interface changes expected.

- `src/backends/codex.ts` — `codex exec`, MCP entry in `.codex/config.toml`; note
  OpenAI's own docs recommend API-key auth (not ChatGPT sign-in) for CI/CD use.
- `src/backends/gemini-cli.ts` — `gemini --non-interactive --yolo --output-format
  json`, `mcpServers` entry in `.gemini/settings.json`.
- `src/backends/api.ts` — `@anthropic-ai/sdk`'s `toolRunner` + `betaZodTool` +
  `zodOutputFormat` (skip the file-handoff validate/retry path — schema conformance is
  SDK-enforced here).
- `src/backends/resolve.ts` — extend `AUTO_PREFERENCE_ORDER`, no other changes.

**Acceptance**: `--llmBackend codex` (and `gemini-cli`) complete the same Phase 1
scenario end to end; `--llmBackend api` requires only `ANTHROPIC_API_KEY`, no CLI
installed.

## Testing strategy

`backends/resolve.ts`'s preference-order logic is pure and deterministic → unit
tested. Each new adapter is a subprocess/SDK integration → covered by this phase's
manual acceptance check per backend, not mocked.

## Tasks

Not yet broken down into task files — this phase hasn't started. Create task files
(same shape as Phase 0-2's) as work on each Plan bullet begins, rather than
scaffolding empty "_Not started._" files ahead of time.

# Task: `src/engine/findings-handoff.ts`

**Phase:** [1 — Single scenario, fixed W3C guideline, no picker](./overview.md)
**Status:** done

## Plan

`src/engine/findings-handoff.ts` — read + validate against `ScenarioFindingsSchema`,
retry once on failure, else surface `Status: ERROR`.

## Implementation log

`readAndValidateFindings` implemented per plan — read the findings file, `safeParse`
against `ScenarioFindingsSchema`, and on failure (missing file, bad JSON, or schema
mismatch) re-invoke `backend.runScenario` once with `previousValidationError` set (new
optional field on `LlmBackendRunOptions`, folded into `claude-code.ts`'s prompt as a
full re-walk instruction, not a JSON-patch instruction — the subprocess is stateless
and has no memory of the first attempt). If the retry still fails validation, returns a
synthesized `{ status: "ERROR" }` findings object with the validation error in `notes`,
matching the old skill's Chrome-unavailable `ERROR` convention referenced in
`UX_AUDIT_CLI_PLAN.md` Open risks.

## Testing evidence

Not unit tested, matching this phase's testing strategy — the only non-trivial branch
(the retry) depends on a real backend subprocess, not mockable logic. Exercised
indirectly via the full acceptance run (see
[08-run-command-single-scenario.md](./08-run-command-single-scenario.md), first-attempt
success path — the retry branch itself still hasn't been forced/observed live, would
need a scenario deliberately crafted to make the agent write malformed JSON).

Phase 2 generalized this module's read/validate/retry skeleton for reuse by report
synthesis — see
[`phase-2-multi-scenario/02-report-data-model-and-synthesis-backend.md`](../phase-2-multi-scenario/02-report-data-model-and-synthesis-backend.md).

## Gotchas / drift from plan

N/A

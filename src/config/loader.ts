import type { AppConfig, AppOverview, Credentials, Guideline, ScenarioConfig } from "../types/index.js";

// See docs/IMPLEMENTATION_PLAN.md Phase 0 — read + validate against config/schema.ts,
// throw a descriptive error (missing `ux-audit init`) rather than a raw fs/zod error.

export async function loadConfig(_cwd?: string): Promise<AppConfig> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 0");
}

export async function loadAppOverview(_cwd?: string): Promise<AppOverview> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 0");
}

export async function loadScenarios(_cwd?: string): Promise<ScenarioConfig[]> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
}

export async function loadCredentials(_ref: string, _cwd?: string): Promise<Credentials> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
}

export async function loadGuideline(_name: string, _cwd?: string): Promise<Guideline> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 3");
}

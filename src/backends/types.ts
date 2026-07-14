import type { AppOverview, ScenarioConfig } from "../types/index.js";

export interface LlmBackendRunOptions {
  scenario: ScenarioConfig;
  appOverview: AppOverview;
  mcpServerConfigPath: string;
  findingsOutputPath: string;
}

export interface LlmBackend {
  readonly name: string;

  /** Is this backend installed and already logged in? Used by "auto" resolution and preflight. */
  isAvailable(): Promise<boolean>;

  /** Spawn the backend non-interactively to walk one scenario and write findings JSON. */
  runScenario(options: LlmBackendRunOptions): Promise<void>;

  /** Spawn the backend (no browser tools) to synthesize the cross-scenario report. */
  synthesizeReport(findingsPaths: string[], appOverview: AppOverview): Promise<unknown>;
}

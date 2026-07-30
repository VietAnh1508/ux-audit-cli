import type { AppOverview, Credentials, ScenarioConfig, ScenarioFindings } from "../types/index.js";

export interface LlmBackendRunOptions {
  scenario: ScenarioConfig;
  appOverview: AppOverview;
  /** Resolved by the engine: scenario.scenarioUrl if set, else appOverview.url. */
  url: string;
  /** Resolved from scenario.credentialsRef by the engine; absent for public, no-auth scenarios. */
  credentials?: Credentials;
  mcpServerConfigPath: string;
  findingsOutputPath: string;
  /**
   * Set by the engine's findings-handoff retry (see src/engine/findings-handoff.ts) when the
   * previous attempt's findings JSON failed schema validation. The subprocess is stateless, so
   * this triggers a full re-walk, not just a JSON patch — backends must fold it into the prompt
   * alongside (not instead of) the normal walk instructions.
   */
  previousValidationError?: string;
}

export interface SynthesizeReportOptions {
  /**
   * Already read and schema-validated by report/synthesize.ts (see
   * src/engine/findings-handoff.ts's tryReadJson) — backends embed this directly rather
   * than re-reading the findings files themselves.
   */
  scenarioFindings: ScenarioFindings[];
  appOverview: AppOverview;
  outputPath: string;
  /**
   * Set by report/synthesize.ts's read-and-validate retry when the previous attempt's
   * output JSON failed schema validation — same retry contract as
   * LlmBackendRunOptions.previousValidationError.
   */
  previousValidationError?: string;
}

export interface LlmBackend {
  readonly name: string;

  /** Is this backend installed and already logged in? Used by "auto" resolution and preflight. */
  isAvailable(): Promise<boolean>;

  /** Spawn the backend non-interactively to walk one scenario and write findings JSON. */
  runScenario(options: LlmBackendRunOptions): Promise<void>;

  /** Spawn the backend (no browser tools) to synthesize the cross-scenario report. */
  synthesizeReport(options: SynthesizeReportOptions): Promise<void>;
}

import { z } from "zod";
import { FindingSchema, ScenarioFindingsSchema } from "../config/schema.js";

export const CrossScenarioFindingSchema = FindingSchema.extend({
  appearsIn: z.array(z.string()).min(2),
});

// A report section is exactly one scenario's findings — same shape as
// ScenarioFindingsSchema, so synthesize.ts can pass parsed ScenarioFindings straight
// into `sections` with no separate mapping step.
export const ReportSectionSchema = ScenarioFindingsSchema;

export const ReportSchema = z.object({
  appName: z.string(),
  executiveSummary: z.string(),
  crossScenarioFindings: z.array(CrossScenarioFindingSchema),
  sections: z.array(ReportSectionSchema),
  quickWins: z.array(z.string()).default([]),
  featureSuggestions: z.array(z.string()).default([]),
});

export type Report = z.infer<typeof ReportSchema>;

// The narrow shape backend.synthesizeReport() is actually asked to produce — `sections`
// and `appName` are assembled by synthesize.ts from each scenario's already-validated
// ScenarioFindings, not re-authored by the model (which would risk paraphrasing or
// dropping the axe-derived findings run-scenario.ts appends). Derived from ReportSchema
// (a strict superset) rather than redeclared, so the two can't drift out of sync. See
// docs/IMPLEMENTATION_PLAN.md Phase 2.
export const SynthesisOutputSchema = ReportSchema.omit({ appName: true, sections: true });

export type SynthesisOutput = z.infer<typeof SynthesisOutputSchema>;

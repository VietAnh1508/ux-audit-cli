import { z } from "zod";
import { FindingSchema, ScreenNoteSchema } from "../config/schema.js";

export const CrossScenarioFindingSchema = FindingSchema.extend({
  appearsIn: z.array(z.string()).min(2),
});

export const ReportSectionSchema = z.object({
  scenarioSlug: z.string(),
  status: z.enum(["OK", "ERROR", "BLOCKED"]),
  findings: z.array(FindingSchema),
  screenNotes: z.array(ScreenNoteSchema).default([]),
  notes: z.string().optional(),
});

export const ReportSchema = z.object({
  appName: z.string(),
  executiveSummary: z.string(),
  crossScenarioFindings: z.array(CrossScenarioFindingSchema),
  sections: z.array(ReportSectionSchema),
  quickWins: z.array(z.string()).default([]),
  featureSuggestions: z.array(z.string()).default([]),
});

export type Report = z.infer<typeof ReportSchema>;

import type { AppOverview } from "../types/index.js";

export const APP_OVERVIEW_FIELDS: Array<{ key: keyof AppOverview; message: string }> = [
  { key: "name", message: "App name" },
  { key: "description", message: "One-paragraph description of what the app does" },
  { key: "coreBusiness", message: "Core business model (e.g. subscription, ad-supported, marketplace)" },
  { key: "targetUsers", message: "Target user segments (who this app is for)" },
];

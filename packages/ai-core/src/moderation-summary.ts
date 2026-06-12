import { mockModerationSummaryProvider } from "./mock-moderation-summary-provider.js";
import type { ModerationSummaryInput, ModerationSummaryOutput } from "./types.js";

export async function summarizeModerationCase(
  input: ModerationSummaryInput
): Promise<ModerationSummaryOutput> {
  return mockModerationSummaryProvider.summarizeModerationCase(input);
}

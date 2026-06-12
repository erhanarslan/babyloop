import {
  MockModerationSummaryProvider,
  OpenAiModerationSummaryProvider,
  type ModerationSummaryProvider
} from "@babyloop/ai-core";
import type { AiModerationSummaryRuntimeConfig } from "../config/env.js";

export function createAdminModerationAiSummaryProvider(
  config: AiModerationSummaryRuntimeConfig
): ModerationSummaryProvider {
  if (config.provider === "openai") {
    return new OpenAiModerationSummaryProvider({
      apiKey: config.apiKey,
      model: config.model,
      ...(config.endpoint ? { endpoint: config.endpoint } : {})
    });
  }

  return new MockModerationSummaryProvider();
}

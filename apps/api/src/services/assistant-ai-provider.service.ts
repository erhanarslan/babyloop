import {
  mockAssistantMessageProvider,
  OpenAiAssistantMessageProvider,
  type AssistantMessageProvider
} from "@babyloop/ai-core";
import type { AssistantRuntimeConfig } from "../config/env.js";

export function createAssistantMessageProvider(
  config: AssistantRuntimeConfig
): AssistantMessageProvider | null {
  if (config.provider === "unavailable") {
    return null;
  }

  if (config.provider === "mock") {
    return mockAssistantMessageProvider;
  }

  return new OpenAiAssistantMessageProvider({
    apiKey: config.apiKey,
    model: config.model,
    ...(config.endpoint ? { endpoint: config.endpoint } : {})
  });
}

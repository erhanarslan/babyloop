import {
  mockListingDraftSuggestionProvider,
  OpenAiListingDraftSuggestionProvider,
  type ListingDraftSuggestionProvider
} from "@babyloop/ai-core";
import type { AiListingDraftRuntimeConfig } from "../config/env.js";

export function createListingDraftAiProvider(
  config: AiListingDraftRuntimeConfig
): ListingDraftSuggestionProvider | null {
  if (config.provider === "unavailable") {
    return null;
  }

  if (config.provider === "mock") {
    return mockListingDraftSuggestionProvider;
  }

  return new OpenAiListingDraftSuggestionProvider({
    apiKey: config.apiKey,
    model: config.model,
    ...(config.endpoint ? { endpoint: config.endpoint } : {})
  });
}

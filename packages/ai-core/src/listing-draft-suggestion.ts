import { mockListingDraftSuggestionProvider } from "./mock-listing-draft-suggestion-provider.js";
import type {
  ListingDraftSuggestionInput,
  ListingDraftSuggestionOutput,
  ListingDraftSuggestionProvider
} from "./types.js";

export async function suggestListingDraft(
  input: ListingDraftSuggestionInput,
  provider: ListingDraftSuggestionProvider = mockListingDraftSuggestionProvider
): Promise<ListingDraftSuggestionOutput> {
  return provider.suggestListingDraft(input);
}

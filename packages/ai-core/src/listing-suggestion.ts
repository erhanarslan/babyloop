import { mockListingSuggestionProvider } from "./mock-listing-suggestion-provider.js";
import type { ListingSuggestionInput, ListingSuggestionOutput } from "./types.js";

export async function suggestListing(
  input: ListingSuggestionInput
): Promise<ListingSuggestionOutput> {
  return mockListingSuggestionProvider.suggestListing(input);
}

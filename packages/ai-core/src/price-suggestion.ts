import { mockPriceSuggestionProvider } from "./mock-price-suggestion-provider.js";
import type { PriceSuggestionInput, PriceSuggestionOutput } from "./types.js";

export async function suggestPrice(
  input: PriceSuggestionInput
): Promise<PriceSuggestionOutput> {
  return mockPriceSuggestionProvider.suggestPrice(input);
}

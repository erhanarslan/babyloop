export type ListingSuggestionInput = {
  title?: string;
  description?: string;
  categoryName?: string;
  condition?: string;
};

export type ListingSuggestionOutput = {
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedTags: string[];
  missingInfoQuestions: string[];
  confidenceScore: number;
  providerName: string;
  promptVersion: string;
};

export type ListingSuggestionProvider = {
  readonly providerName: string;
  suggestListing(input: ListingSuggestionInput): Promise<ListingSuggestionOutput>;
};

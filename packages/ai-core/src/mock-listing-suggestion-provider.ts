import { LISTING_SUGGESTION_PROMPT_VERSION } from "./prompt-versions.js";
import type {
  ListingSuggestionInput,
  ListingSuggestionOutput,
  ListingSuggestionProvider
} from "./types.js";

const MOCK_PROVIDER_NAME = "mock-listing-suggestion";

export class MockListingSuggestionProvider implements ListingSuggestionProvider {
  readonly providerName = MOCK_PROVIDER_NAME;

  async suggestListing(input: ListingSuggestionInput): Promise<ListingSuggestionOutput> {
    const categoryName = normalize(input.categoryName) ?? "Baby product";
    const condition = normalize(input.condition) ?? "condition not specified";
    const title = normalize(input.title);
    const description = normalize(input.description);
    const missingInfoQuestions = buildMissingInfoQuestions(input);

    return {
      suggestedTitle: title ?? `${categoryName} in ${condition} condition`,
      suggestedDescription:
        description ??
        `A ${categoryName.toLowerCase()} listed in ${condition} condition. Add brand, model, age, included pieces, and pickup details before publishing.`,
      suggestedTags: buildTags(categoryName, condition),
      missingInfoQuestions,
      confidenceScore: calculateConfidenceScore(input, missingInfoQuestions.length),
      providerName: this.providerName,
      promptVersion: LISTING_SUGGESTION_PROMPT_VERSION
    };
  }
}

export const mockListingSuggestionProvider = new MockListingSuggestionProvider();

function normalize(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function buildTags(categoryName: string, condition: string): string[] {
  return unique([
    slugify(categoryName),
    slugify(condition),
    "manual-review",
    "babyloop"
  ]);
}

function buildMissingInfoQuestions(input: ListingSuggestionInput): string[] {
  const questions: string[] = [];

  if (!normalize(input.title)) {
    questions.push("What is the product brand and model?");
  }

  if (!normalize(input.description)) {
    questions.push("What is included, missing, worn, or damaged?");
  }

  if (!normalize(input.categoryName)) {
    questions.push("Which product category best fits this item?");
  }

  if (!normalize(input.condition)) {
    questions.push("What is the current condition of the item?");
  }

  return questions;
}

function calculateConfidenceScore(
  input: ListingSuggestionInput,
  missingInfoCount: number
): number {
  const providedFieldCount = [
    input.title,
    input.description,
    input.categoryName,
    input.condition
  ].filter((value) => normalize(value)).length;
  const rawScore = 0.35 + providedFieldCount * 0.15 - missingInfoCount * 0.05;

  return clamp(roundToTwoDecimals(rawScore), 0.2, 0.9);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

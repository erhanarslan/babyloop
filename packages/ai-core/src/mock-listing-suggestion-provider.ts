import { LISTING_SUGGESTION_PROMPT_VERSION } from "./prompt-versions.js";
import type {
  ListingSuggestionInput,
  ListingSuggestionOutput,
  ListingSuggestionProvider
} from "./types.js";

const MOCK_PROVIDER_NAME = "mock-listing-suggestion";

const contactAddressPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const contactNumberPattern = /(?:\+?\d[\d\s().-]{7,}\d)/g;

type CategoryMatch = {
  slug: string;
  name: string;
  keywords: string[];
};

const CATEGORY_MATCHES: CategoryMatch[] = [
  {
    slug: "baby-strollers",
    name: "Baby stroller",
    keywords: ["stroller", "puset", "bebek arabasi", "bebek arabası", "travel system"]
  },
  {
    slug: "car-seats",
    name: "Car seat",
    keywords: ["car seat", "oto koltuk", "ana kucagi", "ana kucağı"]
  },
  {
    slug: "cribs",
    name: "Crib",
    keywords: ["crib", "besik", "beşik", "park yatak", "yatak"]
  },
  {
    slug: "toys",
    name: "Toy",
    keywords: ["toy", "oyuncak", "lego", "puzzle", "pelus", "peluş"]
  },
  {
    slug: "clothing",
    name: "Clothing",
    keywords: ["clothing", "kiyafet", "body", "tulum", "mont", "elbise", "ayakkabi", "ayakkabı"]
  },
  {
    slug: "feeding",
    name: "Feeding",
    keywords: ["feeding", "mama", "biberon", "suluk", "sandalyesi", "high chair"]
  }
];

export class MockListingSuggestionProvider implements ListingSuggestionProvider {
  readonly providerName = MOCK_PROVIDER_NAME;

  async suggestListing(input: ListingSuggestionInput): Promise<ListingSuggestionOutput> {
    const category = inferCategory(input);
    const condition = inferCondition(input);
    const listingType = inferListingType(input);
    const title = normalize(input.title);
    const description = normalize(input.description);
    const missingInfoQuestions = buildMissingInfoQuestions(input);
    const safetyWarnings = buildSafetyWarnings(input);

    return {
      suggestedTitle:
        title !== undefined
          ? redactContactDetails(title)
          : buildSuggestedTitle(category.name, condition, listingType),
      suggestedDescription:
        description !== undefined
          ? redactContactDetails(description)
          : buildSuggestedDescription(category.name, condition, listingType),
      suggestedCategorySlug: category.slug,
      suggestedCategoryName: category.name,
      suggestedCondition: condition,
      suggestedListingType: listingType,
      suggestedTags: buildTags(category.name, condition, listingType),
      safetyWarnings,
      missingInfoQuestions,
      confidenceScore: calculateConfidenceScore(input, missingInfoQuestions.length, safetyWarnings.length),
      providerName: this.providerName,
      promptVersion: LISTING_SUGGESTION_PROMPT_VERSION
    };
  }
}

export const mockListingSuggestionProvider = new MockListingSuggestionProvider();

function inferCategory(input: ListingSuggestionInput): { slug: string | null; name: string } {
  const providedCategoryName = normalize(input.categoryName);

  if (providedCategoryName) {
    return {
      slug: slugify(providedCategoryName),
      name: providedCategoryName
    };
  }

  const combinedText = normalizeSearchText([input.title, input.description].join(" "));
  const matchedCategory = CATEGORY_MATCHES.find((category) =>
    category.keywords.some((keyword) => combinedText.includes(normalizeSearchText(keyword)))
  );

  if (matchedCategory) {
    return {
      slug: matchedCategory.slug,
      name: matchedCategory.name
    };
  }

  return {
    slug: null,
    name: "Baby product"
  };
}

function inferCondition(input: ListingSuggestionInput): string {
  const providedCondition = normalize(input.condition);

  if (providedCondition) {
    return providedCondition;
  }

  const combinedText = normalizeSearchText([input.title, input.description].join(" "));

  if (includesAny(combinedText, ["sifir", "sıfır", "new", "unused", "kullanilmamis", "kullanılmamış"])) {
    return "new";
  }

  if (includesAny(combinedText, ["az kullanilmis", "az kullanılmış", "like new", "cok temiz", "çok temiz"])) {
    return "like_new";
  }

  if (includesAny(combinedText, ["yipranmis", "yıpranmış", "leke", "hasar", "damaged", "worn"])) {
    return "fair";
  }

  return "good";
}

function inferListingType(input: ListingSuggestionInput): "sale" | "swap" | "donation" {
  if (input.listingType === "sale" || input.listingType === "swap" || input.listingType === "donation") {
    return input.listingType;
  }

  const combinedText = normalizeSearchText([input.title, input.description].join(" "));

  if (includesAny(combinedText, ["bagis", "bağış", "ucretsiz", "ücretsiz", "free", "donation"])) {
    return "donation";
  }

  if (includesAny(combinedText, ["takas", "swap"])) {
    return "swap";
  }

  return "sale";
}

function buildSuggestedTitle(
  categoryName: string,
  condition: string,
  listingType: "sale" | "swap" | "donation"
): string {
  const listingTypeLabel = listingType === "donation" ? "donation" : listingType === "swap" ? "swap" : "sale";
  return `${categoryName} for ${listingTypeLabel} · ${formatCondition(condition)}`;
}

function buildSuggestedDescription(
  categoryName: string,
  condition: string,
  listingType: "sale" | "swap" | "donation"
): string {
  const actionText =
    listingType === "donation"
      ? "This item is offered as a donation."
      : listingType === "swap"
        ? "This item is available for swap."
        : "This item is available for sale.";

  return `${actionText} ${categoryName} in ${formatCondition(condition)} condition. Add brand, model, age range, included pieces, visible wear, pickup area, and clear photos before publishing.`;
}

function buildTags(
  categoryName: string,
  condition: string,
  listingType: "sale" | "swap" | "donation"
): string[] {
  return unique([
    slugify(categoryName),
    slugify(condition),
    listingType,
    "manual-review",
    "babyloop"
  ]);
}

function buildSafetyWarnings(input: ListingSuggestionInput): string[] {
  const warnings: string[] = [];
  const combinedText = [input.title, input.description].filter(isNonEmptyString).join(" ");

  if (hasContactDetails(combinedText)) {
    warnings.push("Contact details should stay out of listing text; keep buyer communication inside BabyLoop.");
  }

  const normalizedText = normalizeSearchText(combinedText);

  if (includesAny(normalizedText, ["car seat", "oto koltuk", "ana kucagi", "ana kucağı", "crib", "besik", "beşik"])) {
    warnings.push("For safety-critical products, add production date, standards label, damage history, and clear photos.");
  }

  if (includesAny(normalizedText, ["kirik", "kırık", "hasarli", "hasarlı", "damaged"])) {
    warnings.push("Mention damage clearly and add close-up photos before publishing.");
  }

  return warnings;
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

  if (!input.listingType) {
    questions.push("Is this item for sale, swap, or donation?");
  }

  return questions;
}

function calculateConfidenceScore(
  input: ListingSuggestionInput,
  missingInfoCount: number,
  safetyWarningCount: number
): number {
  const providedFieldCount = [
    input.title,
    input.description,
    input.categoryName,
    input.condition,
    input.listingType
  ].filter((value) => normalize(value)).length;
  const rawScore = 0.35 + providedFieldCount * 0.13 - missingInfoCount * 0.04 - safetyWarningCount * 0.03;

  return clamp(roundToTwoDecimals(rawScore), 0.2, 0.92);
}

function normalize(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function formatCondition(condition: string): string {
  return condition.replace(/_/g, " ");
}

function includesAny(value: string, tokens: string[]): boolean {
  return tokens.some((token) => value.includes(normalizeSearchText(token)));
}

function redactContactDetails(value: string): string {
  return value
    .replace(contactAddressPattern, "[contact detail removed]")
    .replace(contactNumberPattern, "[contact detail removed]");
}

function hasContactDetails(value: string): boolean {
  contactAddressPattern.lastIndex = 0;
  contactNumberPattern.lastIndex = 0;

  return contactAddressPattern.test(value) || contactNumberPattern.test(value);
}

function slugify(value: string): string {
  return normalizeSearchText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

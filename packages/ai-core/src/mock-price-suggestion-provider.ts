import { PRICE_SUGGESTION_PROMPT_VERSION } from "./prompt-versions.js";
import type {
  PriceSuggestionInput,
  PriceSuggestionOutput,
  PriceSuggestionProvider
} from "./types.js";

const MOCK_PROVIDER_NAME = "mock-price-suggestion";

const CONDITION_MULTIPLIERS: Record<string, number> = {
  new: 1.15,
  like_new: 1,
  good: 0.82,
  fair: 0.58,
  needs_repair: 0.32
};

export class MockPriceSuggestionProvider implements PriceSuggestionProvider {
  readonly providerName = MOCK_PROVIDER_NAME;

  async suggestPrice(input: PriceSuggestionInput): Promise<PriceSuggestionOutput> {
    const currency = normalizeCurrency(input.currency);

    if (input.listingType === "donation") {
      return {
        recommendedPriceAmount: null,
        recommendedPriceMin: null,
        recommendedPriceMax: null,
        currency,
        pricingMode: "not_applicable",
        rationale: [
          "Donation listings do not need a sale price.",
          "Keep the description clear about pickup, condition, and included parts."
        ],
        confidenceScore: 0.78,
        providerName: this.providerName,
        promptVersion: PRICE_SUGGESTION_PROMPT_VERSION
      };
    }

    const categoryBaseline = getCategoryBaseline(input.categoryName ?? input.title ?? "");
    const conditionMultiplier = CONDITION_MULTIPLIERS[input.condition ?? "good"] ?? 0.82;
    const currentPrice = parseOptionalPrice(input.currentPriceAmount);
    const baseline = currentPrice ? average(categoryBaseline * conditionMultiplier, currentPrice) : categoryBaseline * conditionMultiplier;
    const adjusted = input.listingType === "swap" ? baseline * 0.75 : baseline;
    const recommended = roundPrice(adjusted);
    const min = roundPrice(recommended * 0.82);
    const max = roundPrice(recommended * 1.18);

    return {
      recommendedPriceAmount: formatPrice(recommended),
      recommendedPriceMin: formatPrice(min),
      recommendedPriceMax: formatPrice(max),
      currency,
      pricingMode: "suggested",
      rationale: buildRationale(input, categoryBaseline, conditionMultiplier, Boolean(currentPrice)),
      confidenceScore: calculateConfidenceScore(input, Boolean(currentPrice)),
      providerName: this.providerName,
      promptVersion: PRICE_SUGGESTION_PROMPT_VERSION
    };
  }
}

export const mockPriceSuggestionProvider = new MockPriceSuggestionProvider();

function normalizeCurrency(value: string | undefined): string {
  const normalized = value?.trim().toUpperCase();

  return normalized && /^[A-Z]{3}$/.test(normalized) ? normalized : "TRY";
}

function parseOptionalPrice(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getCategoryBaseline(value: string): number {
  const normalized = value.trim().toLocaleLowerCase("tr-TR");

  if (includesAny(normalized, ["bebek arab", "stroller", "puset"])) {
    return 5500;
  }

  if (includesAny(normalized, ["oto koltuk", "car seat", "ana kuca", "anakuca"])) {
    return 4200;
  }

  if (includesAny(normalized, ["montessori", "ahşap oyuncak", "wooden toy"])) {
    return 950;
  }

  if (includesAny(normalized, ["oyuncak", "toy"])) {
    return 650;
  }

  if (includesAny(normalized, ["kıyafet", "kiyafet", "clothes", "giyim"])) {
    return 450;
  }

  if (includesAny(normalized, ["beşik", "besik", "crib", "park yatak", "yatak"])) {
    return 3200;
  }

  if (includesAny(normalized, ["mama sandalye", "high chair", "sandalye"])) {
    return 1800;
  }

  return 1500;
}

function buildRationale(
  input: PriceSuggestionInput,
  categoryBaseline: number,
  conditionMultiplier: number,
  usedCurrentPrice: boolean
): string[] {
  const rationale = [
    `Category baseline estimate: ${formatPrice(categoryBaseline)}.`,
    `Condition adjustment multiplier: ${conditionMultiplier}.`
  ];

  if (input.listingType === "swap") {
    rationale.push("Swap listings are discounted because value negotiation usually happens in chat.");
  }

  if (usedCurrentPrice) {
    rationale.push("Current entered price was used as an additional stabilizing signal.");
  }

  rationale.push("This is an MVP estimate; compare with similar listings before publishing.");

  return rationale;
}

function calculateConfidenceScore(input: PriceSuggestionInput, usedCurrentPrice: boolean): number {
  const signalCount = [
    input.title,
    input.categoryName,
    input.condition,
    input.listingType,
    usedCurrentPrice ? "current-price" : undefined
  ].filter(Boolean).length;

  return clamp(roundToTwoDecimals(0.42 + signalCount * 0.08), 0.35, 0.86);
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function average(first: number, second: number): number {
  return (first + second) / 2;
}

function roundPrice(value: number): number {
  if (value >= 1000) {
    return Math.round(value / 50) * 50;
  }

  return Math.round(value / 10) * 10;
}

function formatPrice(value: number): string {
  return value.toFixed(2);
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

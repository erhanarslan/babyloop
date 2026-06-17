import { LISTING_DRAFT_SUGGESTION_PROMPT_VERSION } from "./prompt-versions.js";
import type {
  ListingDraftSuggestionCategoryCandidate,
  ListingDraftSuggestionCondition,
  ListingDraftSuggestionInput,
  ListingDraftSuggestionOutput,
  ListingDraftSuggestionProvider
} from "./types.js";

const MOCK_PROVIDER_NAME = "mock-listing-draft-suggestion";

export class MockListingDraftSuggestionProvider implements ListingDraftSuggestionProvider {
  readonly providerName = MOCK_PROVIDER_NAME;

  async suggestListingDraft(input: ListingDraftSuggestionInput): Promise<ListingDraftSuggestionOutput> {
    const category = inferCategory(input);
    const condition = inferCondition(input);
    const imageFeedback = input.images.map((image) => ({
      imageIdOrUrl: image.id,
      status: image.dataUrl ? "needs_review" as const : "unclear" as const,
      message: image.dataUrl
        ? "Görsel güvenli biçimde alındı; ürünün tam göründüğünü yine de kontrol et."
        : "Görsel içeriği incelenemedi; başlığı ve kategoriyi sen kontrol et."
    }));
    const hasImages = input.images.length > 0;
    const title = normalize(input.title);
    const description = normalize(input.description);
    const confidence = hasImages && (title || category) ? "medium" : "low";

    return {
      ...(title ? { title: redactContact(title) } : category ? { title: `${category.name} için temiz ilan` } : {}),
      description: buildDescription(input, category, condition, description),
      ...(category ? { categoryId: category.id } : {}),
      condition,
      ...(input.listingType === "sale" || input.priceAmount
        ? {
            priceSuggestion: buildPriceSuggestion(input, category)
          }
        : {}),
      imageFeedback,
      missingDetails: buildMissingDetails(input, hasImages),
      warnings: buildWarnings(input, confidence),
      confidence,
      providerName: this.providerName,
      promptVersion: LISTING_DRAFT_SUGGESTION_PROMPT_VERSION
    };
  }
}

export const mockListingDraftSuggestionProvider = new MockListingDraftSuggestionProvider();

function inferCategory(input: ListingDraftSuggestionInput): ListingDraftSuggestionCategoryCandidate | null {
  if (input.categoryId) {
    return input.categoryCandidates.find((category) => category.id === input.categoryId) ?? null;
  }

  const combinedText = normalizeSearchText([
    input.title,
    input.description,
    input.images.map((image) => image.filename).join(" ")
  ].join(" "));

  return input.categoryCandidates.find((category) =>
    [category.name, category.slug].some((value) => combinedText.includes(normalizeSearchText(value)))
  ) ?? inferKeywordCategory(input.categoryCandidates, combinedText);
}

function inferKeywordCategory(
  categories: ListingDraftSuggestionCategoryCandidate[],
  text: string
): ListingDraftSuggestionCategoryCandidate | null {
  const keywordPairs = [
    ["bebek arab", "stroller"],
    ["puset", "stroller"],
    ["oto kolt", "car"],
    ["mama sandal", "feeding"],
    ["oyuncak", "toy"],
    ["montessori", "montessori"],
    ["park yatak", "crib"],
    ["beşik", "crib"],
    ["kiyafet", "clothing"],
    ["tulum", "clothing"]
  ] as const;

  const match = keywordPairs.find(([keyword]) => text.includes(keyword));

  if (!match) {
    return null;
  }

  return categories.find((category) =>
    normalizeSearchText(`${category.name} ${category.slug}`).includes(match[1])
  ) ?? null;
}

function inferCondition(input: ListingDraftSuggestionInput): ListingDraftSuggestionCondition {
  if (input.condition) {
    return input.condition;
  }

  const text = normalizeSearchText(`${input.title ?? ""} ${input.description ?? ""}`);

  if (includesAny(text, ["sıfır", "sifir", "kullanılmamış", "kullanilmamis", "etiketli"])) {
    return "new";
  }

  if (includesAny(text, ["az kullanılmış", "az kullanilmis", "çok temiz", "cok temiz"])) {
    return "like_new";
  }

  if (includesAny(text, ["leke", "hasar", "yıpran", "yipran", "tamir"])) {
    return "fair";
  }

  return "good";
}

function buildDescription(
  input: ListingDraftSuggestionInput,
  category: ListingDraftSuggestionCategoryCandidate | null,
  condition: ListingDraftSuggestionCondition,
  existingDescription: string | undefined
): string {
  if (existingDescription) {
    return redactContact(existingDescription);
  }

  const categoryText = category?.name ?? "Ürün";
  const conditionText = formatCondition(condition);

  return [
    `${categoryText} için ${conditionText} durumunda ilan taslağı.`,
    "Marka, model, kullanım süresi, varsa eksik parça ve teslim detaylarını ekle.",
    "Görselleri ve ürün durumunu yayınlamadan önce kontrol et."
  ].join(" ");
}

function buildPriceSuggestion(
  input: ListingDraftSuggestionInput,
  category: ListingDraftSuggestionCategoryCandidate | null
): NonNullable<ListingDraftSuggestionOutput["priceSuggestion"]> {
  const currentPrice = input.priceAmount ? Number.parseFloat(input.priceAmount) : NaN;

  if (Number.isFinite(currentPrice) && currentPrice > 0) {
    return {
      min: Math.max(1, Math.round(currentPrice * 0.85)),
      max: Math.round(currentPrice * 1.15),
      currency: "TRY",
      confidence: "low",
      reason: "Mevcut fiyatın etrafında dar bir kontrol aralığı önerildi; piyasa karşılaştırması değildir."
    };
  }

  return {
    min: category ? 250 : 100,
    max: category ? 1500 : 750,
    currency: "TRY",
    confidence: "low",
    reason: "Fiyat için yeterli veri yok; benzer ilanlarla karşılaştırıp sen karar ver."
  };
}

function buildMissingDetails(input: ListingDraftSuggestionInput, hasImages: boolean): string[] {
  const missing: string[] = [];

  if (!normalize(input.title)) {
    missing.push("Ürün adı, marka veya model");
  }

  if (!normalize(input.description)) {
    missing.push("Kullanım durumu, eksik parça ve teslim bilgisi");
  }

  if (!input.categoryId) {
    missing.push("Kategori");
  }

  if (!hasImages) {
    missing.push("En az bir net görsel");
  }

  return missing;
}

function buildWarnings(
  input: ListingDraftSuggestionInput,
  confidence: ListingDraftSuggestionOutput["confidence"]
): string[] {
  const warnings: string[] = [];
  const text = `${input.title ?? ""} ${input.description ?? ""}`;

  if (hasContact(text)) {
    warnings.push("Telefon, e-posta veya adres gibi özel bilgileri ilandan çıkar.");
  }

  if (confidence === "low") {
    warnings.push("Görselden emin olamadım, başlığı ve kategoriyi sen kontrol et.");
  }

  return warnings;
}

function normalize(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");
}

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(normalizeSearchText(needle)));
}

function formatCondition(condition: ListingDraftSuggestionCondition): string {
  const labels: Record<ListingDraftSuggestionCondition, string> = {
    new: "sıfır",
    like_new: "çok temiz",
    good: "iyi",
    fair: "kullanım izi olan",
    needs_repair: "tamir gerektiren"
  };

  return labels[condition];
}

function hasContact(value: string): boolean {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value) || /(?:\+?\d[\d\s().-]{7,}\d)/.test(value);
}

function redactContact(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[iletişim bilgisi çıkarıldı]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[iletişim bilgisi çıkarıldı]");
}

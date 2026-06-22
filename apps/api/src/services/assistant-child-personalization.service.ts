import type { FastifyInstance } from "fastify";
import type { ChildAgeBand, ChildProfileNotificationCadence } from "../schemas/child-profiles.schemas.js";
import {
  listChildProfiles,
  listLifecycleRecommendations,
  type LifecycleRecommendationResponse
} from "./child-profiles.service.js";

export type AssistantChildProfileSummary = {
  label: string;
  ageBand: ChildAgeBand;
  ageBandLabel: string;
  ageMonths: number | null;
  notificationCadence: ChildProfileNotificationCadence;
};

export type AssistantChildRecommendation = {
  label: string;
  query: string;
  filters: Record<string, string>;
  reason: string;
  categorySlug?: string;
};

export type AssistantChildPersonalizationContext = {
  activeChild: AssistantChildProfileSummary | null;
  children: AssistantChildProfileSummary[];
  season: "spring" | "summer" | "autumn" | "winter";
  seasonLabel: string;
  recommendations: AssistantChildRecommendation[];
};

export type AssistantChildNeedDraft = {
  hasChildContext: boolean;
  childLabel: string;
  ageBand: ChildAgeBand | null;
  ageBandLabel: string | null;
  season: "spring" | "summer" | "autumn" | "winter";
  seasonLabel: string;
  suggestedSearches: AssistantChildRecommendation[];
  productFocus: string[];
  note: string;
};

export async function getAssistantChildPersonalizationContext(
  app: FastifyInstance,
  profileId: string,
  now: Date = new Date()
): Promise<AssistantChildPersonalizationContext | null> {
  const rows = (await listChildProfiles(app, profileId)).filter((childProfile) => childProfile.isActive);

  if (rows.length === 0) {
    return null;
  }

  const lifecycleRecommendations = await listLifecycleRecommendations(app, profileId);
  const activeChild = rows[0] ?? null;
  const season = getSeason(now);
  const children = rows.map((childProfile) => ({
    label: sanitizeChildLabel(childProfile.label),
    ageBand: childProfile.ageBand,
    ageBandLabel: formatAgeBandLabel(childProfile.ageBand),
    ageMonths: childProfile.ageMonths,
    notificationCadence: childProfile.notificationCadence
  }));

  return {
    activeChild: activeChild
      ? {
          label: sanitizeChildLabel(activeChild.label),
          ageBand: activeChild.ageBand,
          ageBandLabel: formatAgeBandLabel(activeChild.ageBand),
          ageMonths: activeChild.ageMonths,
          notificationCadence: activeChild.notificationCadence
        }
      : null,
    children,
    season,
    seasonLabel: formatSeasonLabel(season),
    recommendations: buildRecommendationsFromLifecycle(lifecycleRecommendations, season).slice(0, 6)
  };
}

export function buildChildNeedDraft(input: {
  context?: AssistantChildPersonalizationContext | null;
  query: string;
  city?: string | undefined;
  ageBand?: string | undefined;
  ageSignal?: string | undefined;
  productTerms?: string[] | undefined;
  season?: string | undefined;
}): AssistantChildNeedDraft {
  const context = input.context ?? null;
  const activeChild = context?.activeChild ?? null;
  const normalizedAgeBand = normalizeAgeBand(input.ageBand) ?? activeChild?.ageBand ?? deriveAgeBandFromSignal(input.ageSignal);
  const season = normalizeSeason(input.season) ?? context?.season ?? getSeason();
  const seasonLabel = formatSeasonLabel(season);
  const ageBandLabel = normalizedAgeBand ? formatAgeBandLabel(normalizedAgeBand) : null;
  const childLabel = activeChild?.label ?? "Çocuğum";
  const productFocus = buildProductFocus({
    ageBand: normalizedAgeBand,
    productTerms: input.productTerms,
    query: input.query,
    season
  });
  const suggestedSearches = mergeRecommendations([
    ...(context?.recommendations ?? []),
    ...productFocus.map((term) => ({
      label: input.city ? `${term} · ${input.city}` : term,
      query: term,
      filters: {
        ...(input.city ? { city: input.city } : {}),
        ...(normalizedAgeBand ? { ageBand: normalizedAgeBand } : {}),
        season
      },
      reason: buildReason({ ageBandLabel, seasonLabel, term })
    }))
  ]).slice(0, 5);

  return {
    hasChildContext: Boolean(activeChild),
    childLabel,
    ageBand: normalizedAgeBand ?? null,
    ageBandLabel,
    season,
    seasonLabel,
    suggestedSearches,
    productFocus,
    note: "Bu öneriler alışveriş ve ürün takibi içindir; tıbbi veya gelişim değerlendirmesi değildir. Kullanıcı onayı olmadan kayıtlı arama ya da bildirim oluşturulmaz."
  };
}

export function formatAgeBandLabel(ageBand: ChildAgeBand): string {
  const labels: Record<ChildAgeBand, string> = {
    expecting: "Doğum öncesi",
    newborn_0_3: "0-3 ay",
    infant_3_6: "3-6 ay",
    infant_6_12: "6-12 ay",
    toddler_12_24: "12-24 ay",
    preschool_24_36: "24-36 ay",
    child_3_plus: "3 yaş ve üzeri"
  };

  return labels[ageBand];
}

function buildRecommendationsFromLifecycle(
  lifecycleRecommendations: LifecycleRecommendationResponse[],
  season: AssistantChildPersonalizationContext["season"]
): AssistantChildRecommendation[] {
  return lifecycleRecommendations.flatMap((childRecommendation) =>
    childRecommendation.recommendations.map((recommendation) => ({
      label: `${childRecommendation.childProfileLabel} için ${recommendation.categoryName}`,
      query: recommendation.categoryName,
      categorySlug: recommendation.categorySlug,
      filters: {
        ageBand: childRecommendation.ageBand,
        categorySlug: recommendation.categorySlug,
        season
      },
      reason: recommendation.whyNow
    }))
  );
}

function buildProductFocus(input: {
  ageBand: ChildAgeBand | null | undefined;
  productTerms?: string[] | undefined;
  query: string;
  season: AssistantChildPersonalizationContext["season"];
}): string[] {
  const terms = new Set<string>();

  for (const term of input.productTerms ?? []) {
    const normalized = normalizeTerm(term);
    if (normalized) terms.add(normalized);
  }

  for (const term of productTermsForAgeBand(input.ageBand)) terms.add(term);
  for (const term of productTermsForSeason(input.season)) terms.add(term);

  const queryTerm = normalizeTerm(input.query);
  if (terms.size === 0 && queryTerm) terms.add(queryTerm);

  return Array.from(terms).slice(0, 6);
}

function productTermsForAgeBand(ageBand: ChildAgeBand | null | undefined): string[] {
  switch (ageBand) {
    case "expecting":
      return ["bebek arabası", "oto koltuğu", "yenidoğan kıyafet"];
    case "newborn_0_3":
      return ["oto koltuğu", "bebek arabası", "yenidoğan tekstil"];
    case "infant_3_6":
      return ["bebek arabası", "oyun halısı", "çıngırak"];
    case "infant_6_12":
      return ["oyuncak", "mama sandalyesi", "bebek güvenlik ürünü"];
    case "toddler_12_24":
      return ["aktivite oyuncağı", "montessori oyuncak", "çocuk kıyafet"];
    case "preschool_24_36":
      return ["kitap", "yaratıcı oyuncak", "çocuk ayakkabı"];
    case "child_3_plus":
      return ["kitap", "uzun süre kullanılabilecek oyuncak", "dışarı ekipmanı"];
    default:
      return ["bebek ürünü", "oyuncak", "çocuk kıyafet"];
  }
}

function productTermsForSeason(season: AssistantChildPersonalizationContext["season"]): string[] {
  switch (season) {
    case "winter":
      return ["kışlık mont", "uyku tulumu", "kalın kıyafet"];
    case "summer":
      return ["ince kıyafet", "gölgelikli bebek arabası", "suluk"];
    case "spring":
      return ["mevsimlik kıyafet", "yağmurluk", "dışarı oyuncağı"];
    case "autumn":
      return ["mevsimlik mont", "bot", "okul öncesi kitap"];
  }
}

function buildReason(input: { ageBandLabel: string | null; seasonLabel: string; term: string }): string {
  const agePart = input.ageBandLabel ? `${input.ageBandLabel} döneminde` : "Bu dönemde";
  return `${agePart} ${input.seasonLabel.toLocaleLowerCase("tr")} koşulları için ${input.term} aramalarını takip etmek pratik olabilir.`;
}

function getSeason(now: Date = new Date()): AssistantChildPersonalizationContext["season"] {
  const month = now.getMonth() + 1;
  if ([12, 1, 2].includes(month)) return "winter";
  if ([3, 4, 5].includes(month)) return "spring";
  if ([6, 7, 8].includes(month)) return "summer";
  return "autumn";
}

function formatSeasonLabel(season: AssistantChildPersonalizationContext["season"]): string {
  const labels: Record<AssistantChildPersonalizationContext["season"], string> = {
    spring: "İlkbahar",
    summer: "Yaz",
    autumn: "Sonbahar",
    winter: "Kış"
  };

  return labels[season];
}

function normalizeSeason(value: string | undefined): AssistantChildPersonalizationContext["season"] | null {
  if (!value) return null;
  const normalized = value.trim().toLocaleLowerCase("tr");
  if (["winter", "kış", "kis"].includes(normalized)) return "winter";
  if (["spring", "ilkbahar"].includes(normalized)) return "spring";
  if (["summer", "yaz"].includes(normalized)) return "summer";
  if (["autumn", "fall", "sonbahar"].includes(normalized)) return "autumn";
  return null;
}

function deriveAgeBandFromSignal(ageSignal: string | undefined): ChildAgeBand | null {
  if (!ageSignal) return null;
  const normalized = ageSignal.toLocaleLowerCase("tr");
  const monthMatch = /(\d{1,2})\s*ay/u.exec(normalized);
  if (monthMatch) return deriveAgeBandFromMonths(Number(monthMatch[1]));
  const yearMatch = /(\d{1,2})\s*(?:yaş|yas)/u.exec(normalized);
  if (yearMatch) return deriveAgeBandFromMonths(Number(yearMatch[1]) * 12);
  return normalizeAgeBand(normalized);
}

function deriveAgeBandFromMonths(ageMonths: number): ChildAgeBand {
  if (ageMonths <= 3) return "newborn_0_3";
  if (ageMonths <= 6) return "infant_3_6";
  if (ageMonths <= 12) return "infant_6_12";
  if (ageMonths <= 24) return "toddler_12_24";
  if (ageMonths <= 36) return "preschool_24_36";
  return "child_3_plus";
}

function normalizeAgeBand(value: string | undefined): ChildAgeBand | null {
  if (!value) return null;
  const aliases: Record<string, ChildAgeBand> = {
    expecting: "expecting",
    newborn_0_3: "newborn_0_3",
    infant_3_6: "infant_3_6",
    infant_6_12: "infant_6_12",
    toddler_12_24: "toddler_12_24",
    preschool_24_36: "preschool_24_36",
    child_3_plus: "child_3_plus",
    crawler_6_12: "infant_6_12",
    toddler_24_36: "preschool_24_36"
  };

  return aliases[value] ?? null;
}

function mergeRecommendations(recommendations: AssistantChildRecommendation[]): AssistantChildRecommendation[] {
  const seen = new Set<string>();
  const merged: AssistantChildRecommendation[] = [];

  for (const recommendation of recommendations) {
    const key = `${recommendation.query}:${recommendation.filters.categorySlug ?? ""}:${recommendation.filters.ageBand ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(recommendation);
  }

  return merged;
}

function sanitizeChildLabel(label: string): string {
  const normalized = label.replace(/\s+/gu, " ").trim();
  return normalized.length > 0 ? normalized.slice(0, 40) : "Çocuğum";
}

function normalizeTerm(value: string): string | null {
  const normalized = value.replace(/\s+/gu, " ").trim().toLocaleLowerCase("tr");
  if (!normalized || normalized === "ürün") return null;
  return normalized.slice(0, 80);
}

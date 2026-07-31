import {
  childProfiles,
  productCategories
} from "@babyloop/database/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type {
  ChildAgeBand,
  ChildProfileGender,
  ChildProfileNotificationCadence,
  CreateChildProfileBody,
  LifecycleRecommendationsQuery,
  UpdateChildProfileBody
} from "../schemas/child-profiles.schemas.js";
import {
  buildChildAgeStorageValues,
  mergeChildAgeStorageValues,
  resolveChildAgeSnapshot
} from "./child-age.service.js";
import { listAgeMatchedListingsForChild } from "./child-listing-recommendations.service.js";
import type { ListingSummaryResponse } from "./listing-response.mapper.js";

export type ChildProfileResponse = {
  id: string;
  label: string;
  ageBand: ChildAgeBand;
  ageMonths: number | null;
  birthMonth: number | null;
  birthYear: number | null;
  gender: ChildProfileGender | null;
  notificationCadence: ChildProfileNotificationCadence;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LifecycleRecommendationResponse = {
  childProfileId: string;
  childProfileLabel: string;
  ageBand: ChildAgeBand;
  matchedListings?: ListingSummaryResponse[];
  recommendations: Array<{
    categoryId: string;
    categoryName: string;
    categorySlug: string;
    reasonCode: string;
    reasonLabel: string;
    whyNow: string;
    reasoningConfidenceScore: number;
    reasoningProviderName: string;
    reasoningPromptVersion: string;
  }>;
};

type LifecycleRule = {
  categorySlug: string;
  reasonCode: string;
  reasonLabel: string;
};

type LifecycleReasoning = {
  whyNow: string;
  confidenceScore: number;
  providerName: string;
  promptVersion: string;
};

const LIFECYCLE_REASONING_PROVIDER_NAME = "deterministic-lifecycle-reasoner";
const LIFECYCLE_REASONING_PROMPT_VERSION = "lifecycle-reasoning-v1";

const LIFECYCLE_RECOMMENDATION_RULES: Record<ChildAgeBand, LifecycleRule[]> = {
  expecting: [
    {
      categorySlug: "strollers",
      reasonCode: "prepare_for_mobility",
      reasonLabel: "Useful while preparing for newborn mobility needs."
    },
    {
      categorySlug: "car-seats",
      reasonCode: "prepare_for_safe_travel",
      reasonLabel: "Helpful for safe first trips and travel planning."
    }
  ],
  newborn_0_3: [
    {
      categorySlug: "car-seats",
      reasonCode: "safe_travel",
      reasonLabel: "Relevant for safe travel in the first months."
    },
    {
      categorySlug: "strollers",
      reasonCode: "early_mobility",
      reasonLabel: "Relevant for early outdoor mobility."
    }
  ],
  infant_3_6: [
    {
      categorySlug: "strollers",
      reasonCode: "daily_mobility",
      reasonLabel: "Useful for daily walks and practical mobility."
    },
    {
      categorySlug: "toys",
      reasonCode: "early_play",
      reasonLabel: "Age-band appropriate play items may become useful."
    }
  ],
  infant_6_12: [
    {
      categorySlug: "toys",
      reasonCode: "sensory_play",
      reasonLabel: "Relevant for sensory play and exploration."
    },
    {
      categorySlug: "montessori-toys",
      reasonCode: "developmental_play",
      reasonLabel: "Useful for simple developmental play."
    },
    {
      categorySlug: "car-seats",
      reasonCode: "travel_review",
      reasonLabel: "A good time to review travel and seat needs."
    }
  ],
  toddler_12_24: [
    {
      categorySlug: "montessori-toys",
      reasonCode: "toddler_learning",
      reasonLabel: "Relevant for toddler learning and motor-skill play."
    },
    {
      categorySlug: "toys",
      reasonCode: "active_play",
      reasonLabel: "Useful for active toddler play."
    }
  ],
  preschool_24_36: [
    {
      categorySlug: "montessori-toys",
      reasonCode: "preschool_learning",
      reasonLabel: "Relevant for preschool learning and focused play."
    },
    {
      categorySlug: "toys",
      reasonCode: "creative_play",
      reasonLabel: "Useful for creative and social play."
    }
  ],
  child_3_plus: [
    {
      categorySlug: "toys",
      reasonCode: "older_child_play",
      reasonLabel: "Relevant for older child play and learning."
    },
    {
      categorySlug: "montessori-toys",
      reasonCode: "skill_building",
      reasonLabel: "Useful for skill-building activities."
    }
  ]
};

export async function listChildProfiles(
  app: FastifyInstance,
  profileId: string
): Promise<ChildProfileResponse[]> {
  const rows = await app.db
    .select()
    .from(childProfiles)
    .where(eq(childProfiles.profileId, profileId))
    .orderBy(asc(childProfiles.createdAt));

  return rows.map(mapChildProfile);
}

export async function createChildProfile(
  app: FastifyInstance,
  profileId: string,
  body: CreateChildProfileBody
): Promise<ChildProfileResponse> {
  const now = new Date();
  const ageStorage = buildChildAgeStorageValues(body, now);
  const [created] = await app.db
    .insert(childProfiles)
    .values({
      profileId,
      label: body.label,
      ageBand: ageStorage.ageBand,
      ageMonths: ageStorage.ageMonths,
      ageAsOfDate: ageStorage.ageAsOfDate,
      birthMonth: ageStorage.birthMonth,
      birthYear: ageStorage.birthYear,
      gender: body.gender ?? null,
      notificationCadence: body.notificationCadence,
      isActive: body.isActive
    })
    .returning();

  if (!created) {
    throw new Error("Child profile could not be created.");
  }

  return mapChildProfile(created);
}

export async function updateChildProfile(
  app: FastifyInstance,
  profileId: string,
  childProfileId: string,
  body: UpdateChildProfileBody
): Promise<{ status: "updated"; childProfile: ChildProfileResponse } | { status: "not_found" }> {
  const [existing] = await app.db
    .select()
    .from(childProfiles)
    .where(and(eq(childProfiles.id, childProfileId), eq(childProfiles.profileId, profileId)))
    .limit(1);

  if (!existing) {
    return { status: "not_found" };
  }

  const now = new Date();
  const ageStorage = mergeChildAgeStorageValues(
    {
      ageBand: existing.ageBand,
      ageMonths: existing.ageMonths,
      ageAsOfDate: existing.ageAsOfDate,
      birthMonth: existing.birthMonth,
      birthYear: existing.birthYear
    },
    body,
    now
  );

  const [updated] = await app.db
    .update(childProfiles)
    .set({
      ...(body.label !== undefined ? { label: body.label } : {}),
      ageBand: ageStorage.ageBand,
      ageMonths: ageStorage.ageMonths,
      ageAsOfDate: ageStorage.ageAsOfDate,
      birthMonth: ageStorage.birthMonth,
      birthYear: ageStorage.birthYear,
      ...(body.gender !== undefined ? { gender: body.gender } : {}),
      ...(body.notificationCadence !== undefined ? { notificationCadence: body.notificationCadence } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      updatedAt: now
    })
    .where(and(eq(childProfiles.id, childProfileId), eq(childProfiles.profileId, profileId)))
    .returning();

  if (!updated) {
    return { status: "not_found" };
  }

  return {
    status: "updated",
    childProfile: mapChildProfile(updated)
  };
}

export async function deleteChildProfile(
  app: FastifyInstance,
  profileId: string,
  childProfileId: string
): Promise<"deleted" | "not_found"> {
  const [deleted] = await app.db
    .delete(childProfiles)
    .where(and(eq(childProfiles.id, childProfileId), eq(childProfiles.profileId, profileId)))
    .returning({ id: childProfiles.id });

  return deleted ? "deleted" : "not_found";
}

export async function listLifecycleRecommendations(
  app: FastifyInstance,
  profileId: string,
  options: {
    includeMatchedListings?: boolean;
    locale?: LifecycleRecommendationsQuery["locale"];
  } = {}
): Promise<LifecycleRecommendationResponse[]> {
  const childProfileRows = await app.db
    .select()
    .from(childProfiles)
    .where(and(eq(childProfiles.profileId, profileId), eq(childProfiles.isActive, true)))
    .orderBy(asc(childProfiles.createdAt));

  const currentChildProfiles = childProfileRows.map(mapChildProfile);
  const categorySlugs = [
    ...new Set(
      currentChildProfiles.flatMap((childProfile) =>
        LIFECYCLE_RECOMMENDATION_RULES[childProfile.ageBand].map((rule) => rule.categorySlug)
      )
    )
  ];

  if (childProfileRows.length === 0) {
    return [];
  }

  const categoryRows = categorySlugs.length === 0
    ? []
    : await app.db
        .select({
          id: productCategories.id,
          name: productCategories.name,
          slug: productCategories.slug
        })
        .from(productCategories)
        .where(inArray(productCategories.slug, categorySlugs));

  const categoriesBySlug = new Map(categoryRows.map((category) => [category.slug, category]));
  const matchedListingsByChildId: Map<string, ListingSummaryResponse[]> =
    options.includeMatchedListings
      ? new Map(
          await Promise.all(
            currentChildProfiles.map(async (childProfile) => [
              childProfile.id,
              await listAgeMatchedListingsForChild(app, {
                ageMonths: childProfile.ageMonths,
                viewerProfileId: profileId
              })
            ] as const)
          )
        )
      : new Map();

  return currentChildProfiles.map((childProfile) => ({
    childProfileId: childProfile.id,
    childProfileLabel: childProfile.label,
    ageBand: childProfile.ageBand,
    ...(options.includeMatchedListings
      ? { matchedListings: matchedListingsByChildId.get(childProfile.id) ?? [] }
      : {}),
    recommendations: LIFECYCLE_RECOMMENDATION_RULES[childProfile.ageBand]
      .map((rule) => {
        const category = categoriesBySlug.get(rule.categorySlug);

        if (!category) {
          return null;
        }

        const reasoning = buildLifecycleReasoning({
          ageBand: childProfile.ageBand,
          categoryName: category.name,
          locale: options.locale ?? "tr",
          rule
        });

        return {
          categoryId: category.id,
          categoryName: category.name,
          categorySlug: category.slug,
          reasonCode: rule.reasonCode,
          reasonLabel: localizeLifecycleReasonLabel(
            rule.reasonCode,
            rule.reasonLabel,
            options.locale ?? "tr"
          ),
          whyNow: reasoning.whyNow,
          reasoningConfidenceScore: reasoning.confidenceScore,
          reasoningProviderName: reasoning.providerName,
          reasoningPromptVersion: reasoning.promptVersion
        };
      })
      .filter((recommendation): recommendation is NonNullable<typeof recommendation> => recommendation !== null)
  }));
}

function mapChildProfile(row: typeof childProfiles.$inferSelect): ChildProfileResponse {
  const currentAge = resolveChildAgeSnapshot({
    ageBand: row.ageBand,
    ageMonths: row.ageMonths,
    ageAsOfDate: row.ageAsOfDate,
    birthMonth: row.birthMonth,
    birthYear: row.birthYear
  });

  return {
    id: row.id,
    label: row.label,
    ageBand: currentAge.ageBand,
    ageMonths: currentAge.ageMonths,
    birthMonth: row.birthMonth,
    birthYear: row.birthYear,
    gender: row.gender,
    notificationCadence: row.notificationCadence,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function buildLifecycleReasoning(input: {
  ageBand: ChildAgeBand;
  categoryName: string;
  locale: LifecycleRecommendationsQuery["locale"];
  rule: LifecycleRule;
}): LifecycleReasoning {
  return {
    whyNow: buildWhyNow(
      input.ageBand,
      input.categoryName,
      input.rule.reasonCode,
      input.locale
    ),
    confidenceScore: calculateLifecycleConfidence(input.ageBand, input.rule.reasonCode),
    providerName: LIFECYCLE_REASONING_PROVIDER_NAME,
    promptVersion: LIFECYCLE_REASONING_PROMPT_VERSION
  };
}

function buildWhyNow(
  ageBand: ChildAgeBand,
  categoryName: string,
  reasonCode: string,
  locale: LifecycleRecommendationsQuery["locale"]
): string {
  if (locale === "tr") {
    return buildTurkishWhyNow(ageBand, categoryName, reasonCode);
  }

  const ageBandLabel = formatAgeBandForReasoning(ageBand);
  const categoryLabel = categoryName.trim() || "this category";

  switch (reasonCode) {
    case "prepare_for_mobility":
      return `${ageBandLabel} is a practical planning window for mobility gear such as ${categoryLabel}.`;
    case "prepare_for_safe_travel":
      return `${ageBandLabel} is a good stage to compare safe travel essentials before urgent trips begin.`;
    case "safe_travel":
      return `${categoryLabel} stays relevant now because early trips need age-appropriate travel setup.`;
    case "early_mobility":
      return `${ageBandLabel} often brings short outdoor routines, so mobility gear can become useful.`;
    case "daily_mobility":
      return `${ageBandLabel} usually increases daily outings, making practical mobility categories more relevant.`;
    case "early_play":
      return `${ageBandLabel} is when simple play items can support attention, reach, and exploration.`;
    case "sensory_play":
      return `${ageBandLabel} is a common stage for sensory exploration, texture, sound, and grasping activities.`;
    case "developmental_play":
      return `${categoryLabel} can fit this stage because simple cause-and-effect play becomes more useful.`;
    case "travel_review":
      return `${ageBandLabel} is a sensible checkpoint to review whether existing travel gear still fits.`;
    case "toddler_learning":
      return `${ageBandLabel} often shifts toward movement, matching, stacking, and simple problem-solving.`;
    case "active_play":
      return `${ageBandLabel} usually brings more walking and active play, so durable play categories matter.`;
    case "preschool_learning":
      return `${ageBandLabel} is a strong window for focused play, sorting, pretend play, and early independence.`;
    case "creative_play":
      return `${categoryLabel} can support imagination, social play, and longer independent play sessions.`;
    case "older_child_play":
      return `${ageBandLabel} recommendations focus on longer-lasting play value and age-flexible learning.`;
    case "skill_building":
      return `${categoryLabel} is useful now because skill-building items can stay relevant across several months.`;
    default:
      return `${categoryLabel} is recommended because it matches the selected age band and current lifecycle stage.`;
  }
}

function buildTurkishWhyNow(
  ageBand: ChildAgeBand,
  categoryName: string,
  reasonCode: string
): string {
  const ageBandLabel = formatAgeBandForTurkishReasoning(ageBand);
  const categoryLabel = categoryName.trim() || "Bu kategori";

  switch (reasonCode) {
    case "prepare_for_mobility":
      return `${ageBandLabel}; ${categoryLabel} gibi hareketlilik ürünlerini planlamak için uygun bir zamandır.`;
    case "prepare_for_safe_travel":
      return `${ageBandLabel}; ilk yolculuklar başlamadan önce güvenli seyahat ürünlerini karşılaştırmak için uygun bir zamandır.`;
    case "safe_travel":
      return `${categoryLabel}, ilk aylardaki yolculuklarda yaşa uygun bir seyahat düzeni kurmaya yardımcı olabilir.`;
    case "early_mobility":
      return `${ageBandLabel}; kısa açık hava rutinleri başlayabildiği için hareketlilik ürünleri kullanışlı olabilir.`;
    case "daily_mobility":
      return `${ageBandLabel}; günlük gezintiler arttıkça pratik hareketlilik ürünleri daha kullanışlı olabilir.`;
    case "early_play":
      return `${ageBandLabel}; basit oyun ürünleri dikkat, uzanma ve keşfetme becerilerini destekleyebilir.`;
    case "sensory_play":
      return `${ageBandLabel}; doku, ses, kavrama ve duyusal keşif odaklı oyunlar için uygun bir dönemdir.`;
    case "developmental_play":
      return `${categoryLabel}; basit neden-sonuç ilişkilerini keşfetmeye yönelik oyunları destekleyebilir.`;
    case "travel_review":
      return `${ageBandLabel}; mevcut seyahat ürünlerinin hâlâ uygun olup olmadığını gözden geçirmek için iyi bir kontrol noktasıdır.`;
    case "toddler_learning":
      return `${ageBandLabel}; hareket, eşleştirme, üst üste dizme ve basit problem çözme oyunlarının öne çıktığı bir dönemdir.`;
    case "active_play":
      return `${ageBandLabel}; yürüme ve hareketli oyun arttığı için dayanıklı oyun ürünleri daha kullanışlı olabilir.`;
    case "preschool_learning":
      return "24–36 ay dönemi; odaklanma, sınıflandırma, sembolik oyun ve kendi başına oynama becerilerinin gelişimini destekleyen güçlü bir dönemdir.";
    case "creative_play":
      return `${categoryLabel}; hayal gücünü, sosyal oyunu ve daha uzun süre bağımsız oynayabilme becerisini destekleyebilir.`;
    case "older_child_play":
      return `${ageBandLabel}; uzun süre kullanılabilen ve farklı yaşlara uyarlanabilen oyun ürünlerinin öne çıktığı bir dönemdir.`;
    case "skill_building":
      return `${categoryLabel}; beceri geliştirmeye yönelik oyunlarda birkaç ay boyunca kullanılabilir.`;
    default:
      return `${categoryLabel}, seçilen yaş aralığı ve güncel gelişim dönemiyle uyumlu olduğu için önerilir.`;
  }
}

function localizeLifecycleReasonLabel(
  reasonCode: string,
  fallback: string,
  locale: LifecycleRecommendationsQuery["locale"]
): string {
  if (locale === "en") {
    return fallback;
  }

  const labels: Record<string, string> = {
    prepare_for_mobility: "Yenidoğan hareketlilik ihtiyaçlarına hazırlanırken yararlı olabilir.",
    prepare_for_safe_travel: "İlk güvenli yolculukları planlamaya yardımcı olabilir.",
    safe_travel: "İlk aylardaki güvenli yolculuklar için uygundur.",
    early_mobility: "Erken dönem açık hava hareketliliğini destekleyebilir.",
    daily_mobility: "Günlük gezintiler ve pratik hareketlilik için yararlı olabilir.",
    early_play: "Yaşa uygun ilk oyun deneyimlerini destekleyebilir.",
    sensory_play: "Duyusal oyun ve keşif için uygundur.",
    developmental_play: "Basit gelişim odaklı oyunları destekleyebilir.",
    travel_review: "Seyahat ürünlerinin uygunluğunu yeniden değerlendirmek için iyi bir dönemdir.",
    toddler_learning: "Hareket ve öğrenme odaklı küçük çocuk oyunları için uygundur.",
    active_play: "Hareketli oyunları destekleyebilir.",
    preschool_learning: "Okul öncesi odaklanma ve oyun becerilerini destekleyebilir.",
    creative_play: "Yaratıcı ve sosyal oyunları destekleyebilir.",
    older_child_play: "Daha büyük çocukların oyun ve öğrenme ihtiyaçlarına uygundur.",
    skill_building: "Beceri geliştirmeye yönelik etkinliklerde kullanılabilir."
  };

  return labels[reasonCode] ?? "Seçilen yaş aralığı için uygun bir kategori fikridir.";
}

function calculateLifecycleConfidence(ageBand: ChildAgeBand, reasonCode: string): number {
  const baseScoreByAgeBand: Record<ChildAgeBand, number> = {
    expecting: 0.72,
    newborn_0_3: 0.78,
    infant_3_6: 0.76,
    infant_6_12: 0.8,
    toddler_12_24: 0.82,
    preschool_24_36: 0.79,
    child_3_plus: 0.74
  };

  const safetyOrFitBoost = ["prepare_for_safe_travel", "safe_travel", "travel_review"].includes(reasonCode)
    ? 0.04
    : 0;

  return roundToTwoDecimals(Math.min(baseScoreByAgeBand[ageBand] + safetyOrFitBoost, 0.9));
}

function formatAgeBandForReasoning(ageBand: ChildAgeBand): string {
  const labels: Record<ChildAgeBand, string> = {
    expecting: "The expecting stage",
    newborn_0_3: "The 0-3 month stage",
    infant_3_6: "The 3-6 month stage",
    infant_6_12: "The 6-12 month stage",
    toddler_12_24: "The 12-24 month stage",
    preschool_24_36: "The 24-36 month stage",
    child_3_plus: "The 3+ year stage"
  };

  return labels[ageBand];
}

function formatAgeBandForTurkishReasoning(ageBand: ChildAgeBand): string {
  const labels: Record<ChildAgeBand, string> = {
    expecting: "Bebeği bekleme dönemi",
    newborn_0_3: "0–3 ay dönemi",
    infant_3_6: "3–6 ay dönemi",
    infant_6_12: "6–12 ay dönemi",
    toddler_12_24: "12–24 ay dönemi",
    preschool_24_36: "24–36 ay dönemi",
    child_3_plus: "3 yaş ve üzeri dönem"
  };

  return labels[ageBand];
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

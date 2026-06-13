import {
  childProfiles,
  productCategories
} from "@babyloop/database/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type {
  ChildAgeBand,
  CreateChildProfileBody,
  UpdateChildProfileBody
} from "../schemas/child-profiles.schemas.js";

export type ChildProfileResponse = {
  id: string;
  label: string;
  ageBand: ChildAgeBand;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LifecycleRecommendationResponse = {
  childProfileId: string;
  childProfileLabel: string;
  ageBand: ChildAgeBand;
  recommendations: Array<{
    categoryId: string;
    categoryName: string;
    categorySlug: string;
    reasonCode: string;
    reasonLabel: string;
  }>;
};

type LifecycleRule = {
  categorySlug: string;
  reasonCode: string;
  reasonLabel: string;
};

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
  const [created] = await app.db
    .insert(childProfiles)
    .values({
      profileId,
      label: body.label,
      ageBand: body.ageBand,
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
  const [updated] = await app.db
    .update(childProfiles)
    .set({
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.ageBand !== undefined ? { ageBand: body.ageBand } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      updatedAt: new Date()
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
  profileId: string
): Promise<LifecycleRecommendationResponse[]> {
  const childProfileRows = await app.db
    .select()
    .from(childProfiles)
    .where(and(eq(childProfiles.profileId, profileId), eq(childProfiles.isActive, true)))
    .orderBy(asc(childProfiles.createdAt));

  const categorySlugs = [
    ...new Set(
      childProfileRows.flatMap((childProfile) =>
        LIFECYCLE_RECOMMENDATION_RULES[childProfile.ageBand].map((rule) => rule.categorySlug)
      )
    )
  ];

  if (childProfileRows.length === 0 || categorySlugs.length === 0) {
    return [];
  }

  const categoryRows = await app.db
    .select({
      id: productCategories.id,
      name: productCategories.name,
      slug: productCategories.slug
    })
    .from(productCategories)
    .where(inArray(productCategories.slug, categorySlugs));

  const categoriesBySlug = new Map(categoryRows.map((category) => [category.slug, category]));

  return childProfileRows.map((childProfile) => ({
    childProfileId: childProfile.id,
    childProfileLabel: childProfile.label,
    ageBand: childProfile.ageBand,
    recommendations: LIFECYCLE_RECOMMENDATION_RULES[childProfile.ageBand]
      .map((rule) => {
        const category = categoriesBySlug.get(rule.categorySlug);

        if (!category) {
          return null;
        }

        return {
          categoryId: category.id,
          categoryName: category.name,
          categorySlug: category.slug,
          reasonCode: rule.reasonCode,
          reasonLabel: rule.reasonLabel
        };
      })
      .filter((recommendation): recommendation is NonNullable<typeof recommendation> => recommendation !== null)
  }));
}

function mapChildProfile(row: typeof childProfiles.$inferSelect): ChildProfileResponse {
  return {
    id: row.id,
    label: row.label,
    ageBand: row.ageBand,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

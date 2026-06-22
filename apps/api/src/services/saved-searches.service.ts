import { savedSearches } from "@babyloop/database/schema";
import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { CreateSavedSearchBody, UpdateSavedSearchNotificationsBody } from "../schemas/saved-searches.schemas.js";

export type SavedSearchResponse = {
  id: string;
  name: string;
  q: string;
  categoryId: string | null;
  listingType: string | null;
  condition: string | null;
  priceMin: string | null;
  priceMax: string | null;
  hasImages: boolean;
  sort: string;
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function listSavedSearches(
  app: FastifyInstance,
  profileId: string
): Promise<SavedSearchResponse[]> {
  const rows = await app.db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.profileId, profileId))
    .orderBy(desc(savedSearches.createdAt))
    .limit(50);

  return rows.map(mapSavedSearch);
}

export async function createSavedSearch(
  app: FastifyInstance,
  profileId: string,
  body: CreateSavedSearchBody
): Promise<SavedSearchResponse> {
  const [created] = await app.db
    .insert(savedSearches)
    .values({
      profileId,
      name: body.name,
      queryText: body.q ?? null,
      categoryId: body.categoryId ?? null,
      listingType: body.listingType ?? null,
      condition: body.condition ?? null,
      priceMin: body.priceMin ?? null,
      priceMax: body.priceMax ?? null,
      hasImages: body.hasImages,
      sort: body.sort,
      notificationsEnabled: body.notificationsEnabled
    })
    .returning();

  if (!created) {
    throw new Error("Saved search could not be created.");
  }

  return mapSavedSearch(created);
}


export async function updateSavedSearchNotifications(
  app: FastifyInstance,
  profileId: string,
  savedSearchId: string,
  body: UpdateSavedSearchNotificationsBody
): Promise<SavedSearchResponse | "not_found"> {
  const [updated] = await app.db
    .update(savedSearches)
    .set({
      notificationsEnabled: body.notificationsEnabled,
      updatedAt: new Date()
    })
    .where(and(eq(savedSearches.id, savedSearchId), eq(savedSearches.profileId, profileId)))
    .returning();

  return updated ? mapSavedSearch(updated) : "not_found";
}

export async function deleteSavedSearch(
  app: FastifyInstance,
  profileId: string,
  savedSearchId: string
): Promise<"deleted" | "not_found"> {
  const [deleted] = await app.db
    .delete(savedSearches)
    .where(and(eq(savedSearches.id, savedSearchId), eq(savedSearches.profileId, profileId)))
    .returning({ id: savedSearches.id });

  return deleted ? "deleted" : "not_found";
}

function mapSavedSearch(row: typeof savedSearches.$inferSelect): SavedSearchResponse {
  return {
    id: row.id,
    name: row.name,
    q: row.queryText ?? "",
    categoryId: row.categoryId,
    listingType: row.listingType,
    condition: row.condition,
    priceMin: row.priceMin,
    priceMax: row.priceMax,
    hasImages: row.hasImages,
    sort: row.sort,
    notificationsEnabled: row.notificationsEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

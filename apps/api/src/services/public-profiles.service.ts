import { listings, profiles } from "@babyloop/database/schema";
import { and, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

export type PublicSellerProfileSummary = {
  profileId: string;
  displayName: string;
  locationCity: string | null;
  safetyStatus: "active" | "restricted" | "suspended";
  activeListingCount: number;
  soldListingCount: number;
  memberSince: string;
};

export async function getPublicSellerProfileSummary(
  app: FastifyInstance,
  profileId: string
): Promise<PublicSellerProfileSummary | null> {
  const [row] = await app.db
    .select({
      profileId: profiles.id,
      displayName: profiles.displayName,
      locationCity: profiles.locationCity,
      safetyStatus: profiles.safetyStatus,
      memberSince: profiles.createdAt,
      activeListingCount: sql<number>`count(${listings.id}) filter (where ${listings.status} in ('active', 'reserved'))::int`,
      soldListingCount: sql<number>`count(${listings.id}) filter (where ${listings.status} = 'sold')::int`
    })
    .from(profiles)
    .leftJoin(listings, and(
      eq(listings.sellerProfileId, profiles.id),
      eq(listings.sellerProfileId, profileId)
    ))
    .where(eq(profiles.id, profileId))
    .groupBy(profiles.id)
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    profileId: row.profileId,
    displayName: row.displayName,
    locationCity: row.locationCity,
    safetyStatus: row.safetyStatus,
    activeListingCount: row.activeListingCount,
    soldListingCount: row.soldListingCount,
    memberSince: row.memberSince.toISOString()
  };
}

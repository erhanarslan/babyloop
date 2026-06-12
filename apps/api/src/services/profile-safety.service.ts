import { profiles } from "@babyloop/database/schema";
import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

export type ProfileSafetyStatus = "active" | "restricted" | "suspended";

export async function getProfileSafetyStatus(
  app: FastifyInstance,
  profileId: string
): Promise<ProfileSafetyStatus | null> {
  const [profile] = await app.db
    .select({
      safetyStatus: profiles.safetyStatus
    })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  return profile?.safetyStatus ?? null;
}

export async function getProfileSafetyStatuses(
  app: FastifyInstance,
  profileIds: string[]
): Promise<Map<string, ProfileSafetyStatus>> {
  if (profileIds.length === 0) {
    return new Map();
  }

  const rows = await app.db
    .select({
      id: profiles.id,
      safetyStatus: profiles.safetyStatus
    })
    .from(profiles)
    .where(inArray(profiles.id, profileIds));

  return new Map(rows.map((row) => [row.id, row.safetyStatus]));
}

export function canCreateListing(safetyStatus: ProfileSafetyStatus): boolean {
  return safetyStatus === "active";
}

export function canSendMessage(safetyStatus: ProfileSafetyStatus): boolean {
  return safetyStatus === "active";
}

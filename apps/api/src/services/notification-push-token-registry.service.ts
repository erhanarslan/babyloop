import { createHash } from "node:crypto";
import { notificationPushTokens } from "@babyloop/database/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

export type PushTokenPlatform = "ios" | "android" | "expo";

export type RegisterPushTokenInput = {
  token: string;
  platform: PushTokenPlatform;
  deviceLabel?: string | null | undefined;
};

export type PushTokenRegistryResponse = {
  id: string;
  platform: PushTokenPlatform;
  tokenHashPrefix: string;
  redactedToken: string;
  deviceLabel: string | null;
  lastSeenAt: string;
  revokedAt: string | null;
  deliveryAllowed: false;
  providerCallAllowed: false;
};

export async function registerNotificationPushToken(
  app: FastifyInstance,
  profileId: string,
  input: RegisterPushTokenInput
): Promise<PushTokenRegistryResponse> {
  const now = new Date();
  const tokenHash = hashPushToken(input.token);
  const [row] = await app.db
    .insert(notificationPushTokens)
    .values({
      profileId,
      tokenHash,
      platform: input.platform,
      deviceLabel: normalizeDeviceLabel(input.deviceLabel),
      lastSeenAt: now,
      revokedAt: null,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: [notificationPushTokens.profileId, notificationPushTokens.tokenHash],
      set: {
        platform: input.platform,
        deviceLabel: normalizeDeviceLabel(input.deviceLabel),
        lastSeenAt: now,
        revokedAt: null,
        updatedAt: now
      }
    })
    .returning();

  if (!row) {
    throw new Error("Push token registration failed.");
  }

  return mapPushToken(row);
}

export async function listNotificationPushTokens(
  app: FastifyInstance,
  profileId: string
): Promise<PushTokenRegistryResponse[]> {
  const rows = await app.db
    .select()
    .from(notificationPushTokens)
    .where(and(eq(notificationPushTokens.profileId, profileId), isNull(notificationPushTokens.revokedAt)));

  return rows.map(mapPushToken);
}

export async function revokeNotificationPushToken(
  app: FastifyInstance,
  profileId: string,
  token: string
): Promise<"revoked" | "not_found"> {
  const [row] = await app.db
    .update(notificationPushTokens)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date()
    })
    .where(and(
      eq(notificationPushTokens.profileId, profileId),
      eq(notificationPushTokens.tokenHash, hashPushToken(token)),
      isNull(notificationPushTokens.revokedAt)
    ))
    .returning({ id: notificationPushTokens.id });

  return row ? "revoked" : "not_found";
}

function hashPushToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeDeviceLabel(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/gu, " ").trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 80);
}

function mapPushToken(row: typeof notificationPushTokens.$inferSelect): PushTokenRegistryResponse {
  return {
    id: row.id,
    platform: row.platform as PushTokenPlatform,
    tokenHashPrefix: row.tokenHash.slice(0, 12),
    redactedToken: `sha256:${row.tokenHash.slice(0, 8)}...`,
    deviceLabel: row.deviceLabel,
    lastSeenAt: row.lastSeenAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    deliveryAllowed: false,
    providerCallAllowed: false
  };
}

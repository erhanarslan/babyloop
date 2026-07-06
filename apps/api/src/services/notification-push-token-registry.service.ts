import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
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

export type PushTokenDeliveryRecord = {
  id: string;
  platform: PushTokenPlatform;
  token: string;
  tokenHashPrefix: string;
};

export async function registerNotificationPushToken(
  app: FastifyInstance,
  profileId: string,
  input: RegisterPushTokenInput
): Promise<PushTokenRegistryResponse> {
  const now = new Date();
  const tokenHash = hashPushToken(input.token);
  const encryptedToken = encryptPushToken(input.token);
  const [row] = await app.db
    .insert(notificationPushTokens)
    .values({
      profileId,
      tokenHash,
      tokenCiphertext: encryptedToken?.ciphertext ?? null,
      tokenNonce: encryptedToken?.nonce ?? null,
      tokenTag: encryptedToken?.tag ?? null,
      platform: input.platform,
      deviceLabel: normalizeDeviceLabel(input.deviceLabel),
      lastSeenAt: now,
      revokedAt: null,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: [notificationPushTokens.profileId, notificationPushTokens.tokenHash],
      set: {
        tokenCiphertext: encryptedToken?.ciphertext ?? null,
        tokenNonce: encryptedToken?.nonce ?? null,
        tokenTag: encryptedToken?.tag ?? null,
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

export async function listNotificationPushTokensForDelivery(
  app: FastifyInstance,
  profileId: string
): Promise<PushTokenDeliveryRecord[]> {
  const rows = await app.db
    .select()
    .from(notificationPushTokens)
    .where(and(eq(notificationPushTokens.profileId, profileId), isNull(notificationPushTokens.revokedAt)));
  const records: PushTokenDeliveryRecord[] = [];

  for (const row of rows) {
    const token = decryptPushToken({
      ciphertext: row.tokenCiphertext,
      nonce: row.tokenNonce,
      tag: row.tokenTag
    });

    if (!token) {
      continue;
    }

    records.push({
      id: row.id,
      platform: row.platform as PushTokenPlatform,
      token,
      tokenHashPrefix: row.tokenHash.slice(0, 12)
    });
  }

  return records;
}

export async function revokeNotificationPushTokenById(
  app: FastifyInstance,
  profileId: string,
  tokenId: string
): Promise<"revoked" | "not_found"> {
  const [row] = await app.db
    .update(notificationPushTokens)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date()
    })
    .where(and(
      eq(notificationPushTokens.profileId, profileId),
      eq(notificationPushTokens.id, tokenId),
      isNull(notificationPushTokens.revokedAt)
    ))
    .returning({ id: notificationPushTokens.id });

  return row ? "revoked" : "not_found";
}

function hashPushToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getPushTokenEncryptionKey(): Buffer | null {
  const secret = process.env.PUSH_TOKEN_ENCRYPTION_KEY?.trim() || process.env.AUTH_SECRET?.trim();

  if (!secret) {
    return null;
  }

  return createHash("sha256").update(secret).digest();
}

function encryptPushToken(token: string): { ciphertext: string; nonce: string; tag: string } | null {
  const key = getPushTokenEncryptionKey();

  if (!key) {
    return null;
  }

  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64url"),
    nonce: nonce.toString("base64url"),
    tag: tag.toString("base64url")
  };
}

function decryptPushToken(input: {
  ciphertext: string | null;
  nonce: string | null;
  tag: string | null;
}): string | null {
  const key = getPushTokenEncryptionKey();

  if (!key || !input.ciphertext || !input.nonce || !input.tag) {
    return null;
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(input.nonce, "base64url"));
    decipher.setAuthTag(Buffer.from(input.tag, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(input.ciphertext, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return null;
  }
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

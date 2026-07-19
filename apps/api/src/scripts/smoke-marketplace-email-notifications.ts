import { notificationDeliveryLogs, profiles, users } from "@babyloop/database/schema";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { createApp } from "../app.js";
import {
  createMarketplaceEmailNotificationCandidate,
  isMarketplaceEmailProviderConfigured
} from "../services/marketplace-email-notification.service.js";
import { executeNotificationProviderDelivery } from "../services/notification-provider-execution.service.js";
import { isNotificationPreferenceEnabledForDelivery } from "../services/notification-preferences.service.js";

async function main(): Promise<void> {
  assertExplicitSendConfirmation();
  assertMarketplaceEmailConfiguration();

  const recipientEmail = readRequiredEnv("NOTIFICATION_SMOKE_RECIPIENT_EMAIL").toLowerCase();
  const app = createApp();

  try {
    await app.ready();

    if (!("db" in app) || !app.db) {
      throw new Error("DATABASE_URL is required for marketplace email smoke.");
    }

    const [recipient] = await app.db
      .select({
        email: users.email,
        emailVerifiedAt: users.emailVerifiedAt,
        profileId: profiles.id
      })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.email, recipientEmail))
      .limit(1);

    if (!recipient) {
      throw new Error("Smoke recipient must be an existing BabyLoop account.");
    }

    if (!recipient.emailVerifiedAt) {
      throw new Error("Smoke recipient email must be verified before provider testing.");
    }

    const [messagesEnabled, listingEnabled] = await Promise.all([
      isNotificationPreferenceEnabledForDelivery(app, recipient.profileId, "messages", "email"),
      isNotificationPreferenceEnabledForDelivery(app, recipient.profileId, "listing", "email")
    ]);

    if (!messagesEnabled || !listingEnabled) {
      throw new Error(
        "Enable both new-message and listing-favorite email preferences before running the smoke."
      );
    }

    const smokeId = randomUUID();
    const candidates = await Promise.all([
      createMarketplaceEmailNotificationCandidate(app, {
        actionHref: "/conversations",
        kind: "message_received",
        metadata: {
          listingTitle: "Marketplace e-posta smoke ilanı",
          senderDisplayName: "BabyLoop Smoke"
        },
        profileId: recipient.profileId,
        sourceId: `message-smoke:${smokeId}`
      }),
      createMarketplaceEmailNotificationCandidate(app, {
        actionHref: "/my-listings",
        kind: "listing_favorited",
        metadata: {
          listingTitle: "Marketplace e-posta smoke ilanı"
        },
        profileId: recipient.profileId,
        sourceId: `favorite-smoke:${smokeId}`
      })
    ]);

    if (candidates.some((candidate) => candidate.status !== "created" || !candidate.deliveryLogId)) {
      throw new Error("Marketplace email smoke could not create both delivery candidates.");
    }

    const deliveryLogIds = candidates
      .map((candidate) => candidate.deliveryLogId)
      .filter((id): id is string => Boolean(id));

    const results = [];

    for (const deliveryLogId of deliveryLogIds) {
      results.push(
        await executeNotificationProviderDelivery(app, deliveryLogId, {
          env: process.env
        })
      );
    }

    const deliveryLogs = await app.db
      .select({
        id: notificationDeliveryLogs.id,
        kind: notificationDeliveryLogs.kind,
        provider: notificationDeliveryLogs.provider,
        providerStatus: notificationDeliveryLogs.providerStatus,
        status: notificationDeliveryLogs.status
      })
      .from(notificationDeliveryLogs)
      .where(inArray(notificationDeliveryLogs.id, deliveryLogIds));
    const output = {
      ok: results.every((result) => result.status === "sent"),
      recipient: redactEmail(recipient.email),
      sent: results.filter((result) => result.status === "sent").length,
      expected: 2,
      results: results.map((result) => ({
        status: result.status,
        provider: result.provider,
        reason: result.reason,
        retryable: result.retryable
      })),
      logs: deliveryLogs.map((log) => ({
        kind: log.kind,
        status: log.status,
        provider: log.provider,
        providerStatus: log.providerStatus
      }))
    };
    const serialized = JSON.stringify(output, null, 2);

    assertRedactedOutput(serialized, recipient.email);
    console.log(serialized);

    if (!output.ok) {
      throw new Error("Marketplace email smoke did not send both controlled notifications.");
    }
  } finally {
    await app.close();
  }
}

function assertExplicitSendConfirmation(): void {
  if (process.env.NOTIFICATION_MARKETPLACE_SMOKE_CONFIRM_SEND !== "true") {
    throw new Error(
      "Set NOTIFICATION_MARKETPLACE_SMOKE_CONFIRM_SEND=true to confirm two real marketplace emails."
    );
  }
}

function assertMarketplaceEmailConfiguration(): void {
  if (!isMarketplaceEmailProviderConfigured(process.env)) {
    throw new Error("Marketplace Resend configuration is incomplete or disabled.");
  }

  const webAppUrl = process.env.WEB_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();

  try {
    const parsed = new URL(webAppUrl ?? "");

    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new Error("WEB_APP_URL must be an absolute HTTPS URL for marketplace email links.");
  }
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function redactEmail(value: string): string {
  const [name, domain] = value.split("@");

  return name && domain ? `${name.slice(0, 2)}***@${domain}` : "[redacted-email]";
}

function assertRedactedOutput(serialized: string, recipientEmail: string): void {
  if (
    serialized.includes(recipientEmail) ||
    /accessToken|refreshToken|passwordHash|authorization|cookie|api[_-]?key|secret-|Bearer\s+/iu.test(serialized)
  ) {
    throw new Error("Marketplace email smoke output failed redaction guard.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Marketplace email smoke failed.");
  process.exitCode = 1;
});

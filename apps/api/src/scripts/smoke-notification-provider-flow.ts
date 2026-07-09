import { notificationDeliveryLogs, users } from "@babyloop/database/schema";
import { desc, eq } from "drizzle-orm";
import { createApp } from "../app.js";
import {
  processDueChildReminderNotifications,
  type ChildReminderDeliveryChannel
} from "../services/child-reminder-scheduler.service.js";
import { processPendingNotificationProviderDeliveries } from "../services/notification-provider-execution.service.js";

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type AuthPayload = {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
  profile: {
    id: string;
  };
};

const DEFAULT_CHANNELS: ChildReminderDeliveryChannel[] = ["email", "push", "n8n"];

async function main(): Promise<void> {
  const app = createApp();

  try {
    await app.ready();

    if (!("db" in app) || !app.db) {
      throw new Error("DATABASE_URL is required for notification provider smoke.");
    }

    const now = new Date();
    const channels = readChannels(process.env.NOTIFICATION_SMOKE_CHANNELS);
    const email = readSmokeRecipientEmail();
    const password = process.env.NOTIFICATION_SMOKE_PASSWORD?.trim() || "Password123!";
    const reminderTitle = process.env.NOTIFICATION_SMOKE_REMINDER_TITLE?.trim() || "BabyLoop smoke hatırlatıcısı";

    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Notification Smoke",
        email,
        locationCity: "Istanbul",
        password
      }
    });

    assertStatus(register.statusCode, 201, "register", register.body);

    const auth = register.json<ApiSuccess<AuthPayload>>().data;

    await app.db
      .update(users)
      .set({ emailVerifiedAt: now })
      .where(eq(users.id, auth.user.id));

    for (const channel of ["in_app", "email", "push", "n8n"] as const) {
      const preference = await app.inject({
        headers: authHeader(auth.accessToken),
        method: "PATCH",
        url: "/api/v1/notification-preferences",
        payload: {
          source: "child_reminder",
          channel,
          enabled: true,
          reason: "notification provider smoke"
        }
      });

      assertStatus(preference.statusCode, 200, `enable preference ${channel}`, preference.body);
    }

    const rawExpoToken = process.env.NOTIFICATION_SMOKE_EXPO_PUSH_TOKEN?.trim();

    if (rawExpoToken) {
      const registerPush = await app.inject({
        headers: authHeader(auth.accessToken),
        method: "POST",
        url: "/api/v1/notifications/push-tokens",
        payload: {
          token: rawExpoToken,
          platform: "expo",
          deviceLabel: process.env.NOTIFICATION_SMOKE_DEVICE_LABEL?.trim() || "Galaxy S22"
        }
      });

      assertStatus(registerPush.statusCode, 200, "register push token", registerPush.body);
    }

    const childProfile = await app.inject({
      headers: authHeader(auth.accessToken),
      method: "POST",
      url: "/api/v1/child-profiles",
      payload: {
        ageBand: "toddler_12_24",
        label: "Smoke Child"
      }
    });

    assertStatus(childProfile.statusCode, 201, "create child profile", childProfile.body);

    const childProfileId = childProfile.json<ApiSuccess<{
      childProfile: {
        id: string;
      };
    }>>().data.childProfile.id;

    const reminder = await app.inject({
      headers: authHeader(auth.accessToken),
      method: "POST",
      url: `/api/v1/child-profiles/${childProfileId}/reminders`,
      payload: {
        title: reminderTitle,
        scheduleKind: "one_time",
        dueAt: new Date(now.getTime() - 60_000).toISOString()
      }
    });

    assertStatus(reminder.statusCode, 201, "create due reminder", reminder.body);

    const childReminderSummary = await processDueChildReminderNotifications(app, {
      now,
      dryRun: false,
      channels
    });

    const providerSummary = await processPendingNotificationProviderDeliveries(app, {
      now,
      limit: readPositiveInteger(process.env.NOTIFICATION_PROVIDER_PROCESS_LIMIT, 50)
    });

    const logs = await app.db
      .select({
        id: notificationDeliveryLogs.id,
        kind: notificationDeliveryLogs.kind,
        channel: notificationDeliveryLogs.channel,
        status: notificationDeliveryLogs.status,
        provider: notificationDeliveryLogs.provider,
        providerStatus: notificationDeliveryLogs.providerStatus,
        skippedReason: notificationDeliveryLogs.skippedReason,
        attemptCount: notificationDeliveryLogs.attemptCount,
        lastErrorCode: notificationDeliveryLogs.lastErrorCode,
        lastErrorMessageRedacted: notificationDeliveryLogs.lastErrorMessageRedacted,
        providerMessageId: notificationDeliveryLogs.providerMessageId,
        createdAt: notificationDeliveryLogs.createdAt,
        sentAt: notificationDeliveryLogs.sentAt
      })
      .from(notificationDeliveryLogs)
      .where(eq(notificationDeliveryLogs.profileId, auth.profile.id))
      .orderBy(desc(notificationDeliveryLogs.createdAt))
      .limit(20);

    const output = {
      ok: true,
      smokeUser: {
        profileId: auth.profile.id,
        emailRedacted: redactEmail(auth.user.email)
      },
      channels,
      pushTokenProvided: Boolean(rawExpoToken),
      providerEnv: {
        resendEnabled: readBoolean(process.env.NOTIFICATION_EMAIL_ENABLED),
        expoEnabled: readBoolean(process.env.NOTIFICATION_PUSH_ENABLED),
        n8nEnabled: readBoolean(process.env.N8N_NOTIFICATION_WEBHOOK_ENABLED)
      },
      childReminderSummary: {
        processed: childReminderSummary.processed,
        created: childReminderSummary.created,
        skipped: childReminderSummary.skipped,
        blocked: childReminderSummary.blocked,
        providerCallsAllowed: childReminderSummary.providerCallsAllowed,
        deliveryAllowed: childReminderSummary.deliveryAllowed,
        results: childReminderSummary.results.map((item) => ({
          channel: item.channel,
          status: item.status,
          reason: item.reason
        }))
      },
      providerSummary: {
        processed: providerSummary.processed,
        sent: providerSummary.sent,
        skipped: providerSummary.skipped,
        failed: providerSummary.failed,
        retryScheduled: providerSummary.retryScheduled,
        providerCallsAllowed: providerSummary.providerCallsAllowed,
        results: providerSummary.results.map((item) => ({
          status: item.status,
          provider: item.provider,
          retryable: item.retryable,
          reason: item.reason
        }))
      },
      logs: logs.map((log) => ({
        id: log.id,
        kind: log.kind,
        channel: log.channel,
        status: log.status,
        provider: log.provider,
        providerStatus: log.providerStatus,
        skippedReason: log.skippedReason,
        attemptCount: log.attemptCount,
        lastErrorCode: log.lastErrorCode,
        lastErrorMessageRedacted: log.lastErrorMessageRedacted,
        providerMessageId: log.providerMessageId,
        createdAt: log.createdAt.toISOString(),
        sentAt: log.sentAt?.toISOString() ?? null
      }))
    };

    const serialized = JSON.stringify(output, null, 2);

    if (/accessToken|refreshToken|passwordHash|authorization|cookie|set-cookie|api[_-]?key|secret-|Bearer\s+|ExponentPushToken\[/iu.test(serialized)) {
      throw new Error("Smoke output failed redaction guard.");
    }

    console.log(serialized);
  } finally {
    await app.close();
  }
}

function authHeader(token: string): { authorization: string } {
  return {
    authorization: `Bearer ${token}`
  };
}

function assertStatus(actual: number, expected: number, label: string, body: string): void {
  if (actual !== expected) {
    throw new Error(`${label} failed: expected ${expected}, got ${actual}. ${redactUnsafe(body)}`);
  }
}

function readSmokeRecipientEmail(): string {
  const raw = process.env.NOTIFICATION_SMOKE_RECIPIENT_EMAIL?.trim();

  if (raw) {
    return raw;
  }

  return `notification-smoke-${Date.now()}@babyloop.test`;
}

function readChannels(raw: string | undefined): ChildReminderDeliveryChannel[] {
  if (!raw?.trim()) {
    return DEFAULT_CHANNELS;
  }

  const channels = raw
    .split(",")
    .map((item) => item.trim())
    .filter(isSupportedChannel);

  return channels.length > 0 ? Array.from(new Set(channels)) : DEFAULT_CHANNELS;
}

function isSupportedChannel(value: string): value is ChildReminderDeliveryChannel {
  return value === "in_app" || value === "email_draft" || value === "email" || value === "push" || value === "n8n";
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function redactEmail(value: string): string {
  const [name, domain] = value.split("@");

  if (!name || !domain) {
    return "[redacted-email]";
  }

  return `${name.slice(0, 2)}***@${domain}`;
}

function redactUnsafe(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[redacted-email]")
    .replace(/\b(?:accessToken|refreshToken|passwordHash|authorization|cookie|set-cookie|api[_-]?key|secret|token)\b[^\s,;"]*/giu, "[redacted-secret]")
    .slice(0, 500);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Notification provider smoke failed.");
  process.exitCode = 1;
});

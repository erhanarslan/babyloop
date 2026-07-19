import {
  notificationPreferenceAuditEvents,
  notificationPreferences
} from "@babyloop/database/schema";
import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  notificationPreferenceChannelValues,
  notificationPreferenceSourceValues,
  type NotificationPreferenceChannel,
  type NotificationPreferenceDigest,
  type NotificationPreferenceSource,
  type UpdateNotificationPreferenceBody
} from "../schemas/notification-preferences.schemas.js";
import { redactPrivateText } from "./redaction.service.js";
import {
  isNotificationEmailProviderConfigured,
  isNotificationN8nProviderConfigured,
  isNotificationPushProviderConfigured
} from "./notification-email-config.service.js";

export type NotificationPreferenceResponse = {
  id: string | null;
  source: NotificationPreferenceSource;
  channel: NotificationPreferenceChannel;
  enabled: boolean;
  mutedUntil: string | null;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
  digest: NotificationPreferenceDigest;
  deliveryAllowed: boolean;
  providerCallAllowed: boolean;
  draftOnly: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type NotificationPreferenceAuditEventResponse = {
  id: string;
  source: NotificationPreferenceSource;
  channel: NotificationPreferenceChannel;
  oldEnabled: boolean | null;
  newEnabled: boolean;
  oldMutedUntil: string | null;
  newMutedUntil: string | null;
  oldDigest: string | null;
  newDigest: string | null;
  oldQuietHoursStart: string | null;
  newQuietHoursStart: string | null;
  oldQuietHoursEnd: string | null;
  newQuietHoursEnd: string | null;
  reason: string | null;
  createdAt: string;
};

export type NotificationPreferencesSummary = {
  deliveryProvidersEnabled: boolean;
  providerCallsAllowed: boolean;
  emailProviderEnabled: boolean;
  supportedSources: NotificationPreferenceSource[];
  supportedChannels: NotificationPreferenceChannel[];
  defaultEnabledChannels: NotificationPreferenceChannel[];
  draftOnlyChannels: NotificationPreferenceChannel[];
  disabledChannels: NotificationPreferenceChannel[];
};

export type NotificationPreferencesResponse = {
  preferences: NotificationPreferenceResponse[];
  recentAuditEvents: NotificationPreferenceAuditEventResponse[];
  summary: NotificationPreferencesSummary;
};

export async function listNotificationPreferencesForProfile(
  app: FastifyInstance,
  profileId: string
): Promise<NotificationPreferencesResponse> {
  const [preferenceRows, auditRows] = await Promise.all([
    app.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.profileId, profileId)),
    app.db
      .select()
      .from(notificationPreferenceAuditEvents)
      .where(eq(notificationPreferenceAuditEvents.profileId, profileId))
      .orderBy(desc(notificationPreferenceAuditEvents.createdAt))
      .limit(20)
  ]);
  const preferencesByScope = new Map(
    preferenceRows.map((row) => [buildPreferenceScopeKey(row.source, row.channel), row])
  );

  return {
    preferences: notificationPreferenceSourceValues.flatMap((source) =>
      notificationPreferenceChannelValues.map((channel) => {
        const row = preferencesByScope.get(buildPreferenceScopeKey(source, channel));

        return mapPreferenceRow(row ?? {
          id: null,
          source,
          channel,
          enabled: getDefaultEnabled(source, channel),
          mutedUntil: null,
          quietHoursStart: null,
          quietHoursEnd: null,
          timezone: "Europe/Istanbul",
          digest: "immediate",
          createdAt: null,
          updatedAt: null
        }, process.env);
      })
    ),
    recentAuditEvents: auditRows.map(mapAuditEventRow),
    summary: getNotificationPreferenceSummary()
  };
}

export async function updateNotificationPreferenceForProfile(
  app: FastifyInstance,
  profileId: string,
  actorProfileId: string,
  input: UpdateNotificationPreferenceBody
): Promise<{
  preference: NotificationPreferenceResponse;
  auditEvent: NotificationPreferenceAuditEventResponse;
  summary: NotificationPreferencesSummary;
}> {
  const now = new Date();
  const mutedUntil = input.mutedUntil ?? null;
  const quietHoursStart = input.quietHoursStart ?? null;
  const quietHoursEnd = input.quietHoursEnd ?? null;
  const safeReason = input.reason ? redactPrivateText(input.reason) : null;
  const providerSummary = getNotificationPreferenceSummary(process.env);
  const result = await app.db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(notificationPreferences)
      .where(and(
        eq(notificationPreferences.profileId, profileId),
        eq(notificationPreferences.source, input.source),
        eq(notificationPreferences.channel, input.channel)
      ))
      .limit(1);
    const [updatedPreference] = await tx
      .insert(notificationPreferences)
      .values({
        profileId,
        source: input.source,
        channel: input.channel,
        enabled: input.enabled,
        mutedUntil,
        quietHoursStart,
        quietHoursEnd,
        timezone: input.timezone,
        digest: input.digest,
        reason: safeReason,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [
          notificationPreferences.profileId,
          notificationPreferences.source,
          notificationPreferences.channel
        ],
        set: {
          enabled: input.enabled,
          mutedUntil,
          quietHoursStart,
          quietHoursEnd,
          timezone: input.timezone,
          digest: input.digest,
          reason: safeReason,
          updatedAt: now
        }
      })
      .returning();

    if (!updatedPreference) {
      throw new Error("Notification preference update failed.");
    }

    const [auditEvent] = await tx
      .insert(notificationPreferenceAuditEvents)
      .values({
        profileId,
        actorProfileId,
        source: input.source,
        channel: input.channel,
        oldEnabled: existing?.enabled ?? null,
        newEnabled: input.enabled,
        oldMutedUntil: existing?.mutedUntil ?? null,
        newMutedUntil: mutedUntil,
        oldDigest: existing?.digest ?? null,
        newDigest: input.digest,
        oldQuietHoursStart: existing?.quietHoursStart ?? null,
        newQuietHoursStart: quietHoursStart,
        oldQuietHoursEnd: existing?.quietHoursEnd ?? null,
        newQuietHoursEnd: quietHoursEnd,
        reason: safeReason,
        metadata: {
          providerCallsAllowed: providerSummary.providerCallsAllowed,
          deliveryProvidersEnabled: providerSummary.deliveryProvidersEnabled,
          source: input.source,
          channel: input.channel,
          digest: input.digest,
          quietHoursConfigured: Boolean(quietHoursStart || quietHoursEnd)
        }
      })
      .returning();

    if (!auditEvent) {
      throw new Error("Notification preference audit insert failed.");
    }

    return {
      auditEvent,
      preference: updatedPreference
    };
  });

  return {
    preference: mapPreferenceRow(result.preference, process.env),
    auditEvent: mapAuditEventRow(result.auditEvent),
    summary: getNotificationPreferenceSummary(process.env)
  };
}

export async function isNotificationPreferenceEnabledForDelivery(
  app: FastifyInstance,
  profileId: string,
  source: NotificationPreferenceSource,
  channel: NotificationPreferenceChannel
): Promise<boolean> {
  if (source === "security" && channel === "push") {
    return true;
  }

  const [preference] = await app.db
    .select({
      enabled: notificationPreferences.enabled,
      mutedUntil: notificationPreferences.mutedUntil,
      quietHoursStart: notificationPreferences.quietHoursStart,
      quietHoursEnd: notificationPreferences.quietHoursEnd,
      timezone: notificationPreferences.timezone
    })
    .from(notificationPreferences)
    .where(and(
      eq(notificationPreferences.profileId, profileId),
      eq(notificationPreferences.source, source),
      eq(notificationPreferences.channel, channel)
    ))
    .limit(1);

  const enabled = preference?.enabled ?? getDefaultEnabled(source, channel);
  const isMuted = Boolean(preference?.mutedUntil && preference.mutedUntil.getTime() > Date.now());
  const isQuiet = preference ? isNotificationQuietHoursActive(preference) : false;

  return enabled && !isMuted && !isQuiet;
}

export function getNotificationPreferenceSummary(
  env: NodeJS.ProcessEnv = process.env
): NotificationPreferencesSummary {
  const emailEnabled = isNotificationEmailProviderConfigured(env);
  const pushEnabled = isNotificationPushProviderConfigured(env);
  const n8nEnabled = isNotificationN8nProviderConfigured(env);
  const anyProviderEnabled = emailEnabled || pushEnabled || n8nEnabled;
  const draftOnlyChannels: NotificationPreferenceChannel[] = [
    ...(!emailEnabled ? ["email" as const] : []),
    ...(!pushEnabled ? ["push" as const] : []),
    ...(!n8nEnabled ? ["n8n" as const] : []),
    "sms"
  ];

  return {
    deliveryProvidersEnabled: anyProviderEnabled,
    providerCallsAllowed: anyProviderEnabled,
    emailProviderEnabled: emailEnabled,
    supportedSources: [...notificationPreferenceSourceValues],
    supportedChannels: [...notificationPreferenceChannelValues],
    defaultEnabledChannels: ["in_app"],
    draftOnlyChannels,
    disabledChannels: ["sms"]
  };
}

function mapPreferenceRow(row: {
  id: string | null;
  source: NotificationPreferenceSource;
  channel: NotificationPreferenceChannel;
  enabled: boolean;
  mutedUntil: Date | null;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
  digest: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}, env: NodeJS.ProcessEnv): NotificationPreferenceResponse {
  const providerCallAllowed = (
    (row.channel === "email" && isNotificationEmailProviderConfigured(env)) ||
    (row.channel === "push" && isNotificationPushProviderConfigured(env)) ||
    (row.channel === "n8n" && isNotificationN8nProviderConfigured(env))
  );
  const isMuted = Boolean(row.mutedUntil && row.mutedUntil.getTime() > Date.now());
  const isDeliveryAllowed = row.enabled && !isMuted && !isNotificationQuietHoursActive(row) && (
    row.channel === "in_app" || providerCallAllowed
  );

  return {
    id: row.id,
    source: row.source,
    channel: row.channel,
    enabled: row.enabled,
    mutedUntil: row.mutedUntil?.toISOString() ?? null,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
    timezone: row.timezone,
    digest: normalizeDigest(row.digest),
    deliveryAllowed: isDeliveryAllowed,
    providerCallAllowed,
    draftOnly: row.channel !== "in_app" && !providerCallAllowed,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null
  };
}

function normalizeDigest(value: string): NotificationPreferenceDigest {
  return value === "daily" || value === "weekly" ? value : "immediate";
}

function mapAuditEventRow(row: typeof notificationPreferenceAuditEvents.$inferSelect): NotificationPreferenceAuditEventResponse {
  return {
    id: row.id,
    source: row.source,
    channel: row.channel,
    oldEnabled: row.oldEnabled,
    newEnabled: row.newEnabled,
    oldMutedUntil: row.oldMutedUntil?.toISOString() ?? null,
    newMutedUntil: row.newMutedUntil?.toISOString() ?? null,
    oldDigest: row.oldDigest,
    newDigest: row.newDigest,
    oldQuietHoursStart: row.oldQuietHoursStart,
    newQuietHoursStart: row.newQuietHoursStart,
    oldQuietHoursEnd: row.oldQuietHoursEnd,
    newQuietHoursEnd: row.newQuietHoursEnd,
    reason: row.reason,
    createdAt: row.createdAt.toISOString()
  };
}

function buildPreferenceScopeKey(
  source: NotificationPreferenceSource,
  channel: NotificationPreferenceChannel
): string {
  return `${source}:${channel}`;
}

function getDefaultEnabled(
  source: NotificationPreferenceSource,
  channel: NotificationPreferenceChannel
): boolean {
  if (source === "security" && channel === "push") {
    return true;
  }

  if (channel !== "in_app") {
    return false;
  }

  return source !== "marketing";
}

export function isNotificationQuietHoursActive(row: {
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone?: string;
}, now: Date = new Date()): boolean {
  if (!row.quietHoursStart || !row.quietHoursEnd) {
    return false;
  }

  const startMinutes = parseLocalTimeMinutes(row.quietHoursStart);
  const endMinutes = parseLocalTimeMinutes(row.quietHoursEnd);

  if (startMinutes === null || endMinutes === null) {
    return false;
  }

  const currentMinutes = getMinutesInTimezone(now, row.timezone ?? "Europe/Istanbul");

  if (currentMinutes === null || startMinutes === endMinutes) {
    return currentMinutes !== null && startMinutes === endMinutes;
  }

  return startMinutes < endMinutes
    ? currentMinutes >= startMinutes && currentMinutes < endMinutes
    : currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function parseLocalTimeMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/u.exec(value);
  const hours = Number(match?.[1]);
  const minutes = Number(match?.[2]);

  return Number.isInteger(hours) && hours >= 0 && hours <= 23 &&
    Number.isInteger(minutes) && minutes >= 0 && minutes <= 59
    ? hours * 60 + minutes
    : null;
}

function getMinutesInTimezone(now: Date, timezone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      timeZone: timezone
    }).formatToParts(now);
    const hours = Number(parts.find((part) => part.type === "hour")?.value);
    const minutes = Number(parts.find((part) => part.type === "minute")?.value);

    return Number.isInteger(hours) && Number.isInteger(minutes)
      ? hours * 60 + minutes
      : null;
  } catch {
    return null;
  }
}

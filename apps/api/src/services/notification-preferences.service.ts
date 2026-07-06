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
  type NotificationPreferenceSource,
  type UpdateNotificationPreferenceBody
} from "../schemas/notification-preferences.schemas.js";
import { redactPrivateText } from "./redaction.service.js";

export type NotificationPreferenceResponse = {
  id: string | null;
  source: NotificationPreferenceSource;
  channel: NotificationPreferenceChannel;
  enabled: boolean;
  mutedUntil: string | null;
  deliveryAllowed: boolean;
  providerCallAllowed: false;
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
  reason: string | null;
  createdAt: string;
};

export type NotificationPreferencesSummary = {
  deliveryProvidersEnabled: false;
  providerCallsAllowed: false;
  supportedSources: NotificationPreferenceSource[];
  supportedChannels: NotificationPreferenceChannel[];
  defaultEnabledChannels: NotificationPreferenceChannel[];
  draftOnlyChannels: NotificationPreferenceChannel[];
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
          createdAt: null,
          updatedAt: null
        });
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
  const safeReason = input.reason ? redactPrivateText(input.reason) : null;
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
        reason: safeReason,
        metadata: {
          providerCallsAllowed: false,
          deliveryProvidersEnabled: false,
          source: input.source,
          channel: input.channel
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
    preference: mapPreferenceRow(result.preference),
    auditEvent: mapAuditEventRow(result.auditEvent),
    summary: getNotificationPreferenceSummary()
  };
}

export async function isNotificationPreferenceEnabledForDelivery(
  app: FastifyInstance,
  profileId: string,
  source: NotificationPreferenceSource,
  channel: NotificationPreferenceChannel
): Promise<boolean> {
  const [preference] = await app.db
    .select({
      enabled: notificationPreferences.enabled,
      mutedUntil: notificationPreferences.mutedUntil
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

  return channel === "in_app" && enabled && !isMuted;
}

export function getNotificationPreferenceSummary(): NotificationPreferencesSummary {
  return {
    deliveryProvidersEnabled: false,
    providerCallsAllowed: false,
    supportedSources: [...notificationPreferenceSourceValues],
    supportedChannels: [...notificationPreferenceChannelValues],
    defaultEnabledChannels: ["in_app"],
    draftOnlyChannels: ["email", "push", "n8n"]
  };
}

function mapPreferenceRow(row: {
  id: string | null;
  source: NotificationPreferenceSource;
  channel: NotificationPreferenceChannel;
  enabled: boolean;
  mutedUntil: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}): NotificationPreferenceResponse {
  return {
    id: row.id,
    source: row.source,
    channel: row.channel,
    enabled: row.enabled,
    mutedUntil: row.mutedUntil?.toISOString() ?? null,
    deliveryAllowed: row.channel === "in_app" && row.enabled,
    providerCallAllowed: false,
    draftOnly: row.channel !== "in_app",
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null
  };
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
  _source: NotificationPreferenceSource,
  channel: NotificationPreferenceChannel
): boolean {
  return channel === "in_app";
}

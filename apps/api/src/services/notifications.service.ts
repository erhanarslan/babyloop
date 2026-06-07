import { notifications, profiles } from "@babyloop/database/schema";
import type { RealtimeNotification, RealtimeNotificationType } from "@babyloop/shared";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { FastifyInstance } from "fastify";
import { assertSafePlainText } from "./text-safety.service.js";

const actorProfiles = alias(profiles, "notification_actor_profiles");

export type NotificationResponse = RealtimeNotification;

export type CreateNotificationInput = {
  recipientProfileId: string;
  actorProfileId?: string | null;
  type: RealtimeNotificationType;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

type NotificationRow = {
  id: string;
  recipientProfileId: string;
  actorProfileId: string | null;
  actorDisplayName: string | null;
  type: RealtimeNotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
};

export async function createNotification(
  app: FastifyInstance,
  input: CreateNotificationInput
): Promise<NotificationResponse | null> {
  if (input.actorProfileId && input.actorProfileId === input.recipientProfileId) {
    return null;
  }

  const title = assertSafePlainText(input.title, {
    maxLength: 180,
    minLength: 1
  });
  const body = assertSafePlainText(input.body, {
    maxLength: 1000,
    minLength: 1
  });

  const [createdNotification] = await app.db
    .insert(notifications)
    .values({
      recipientProfileId: input.recipientProfileId,
      actorProfileId: input.actorProfileId ?? null,
      type: input.type,
      title,
      body,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {}
    })
    .returning({
      id: notifications.id
    });

  if (!createdNotification) {
    throw new Error("Notification insert failed.");
  }

  const notification = await getNotificationForProfile(
    app,
    input.recipientProfileId,
    createdNotification.id
  );

  if (!notification) {
    throw new Error("Notification lookup failed.");
  }

  return notification;
}

export async function listNotificationsForProfile(
  app: FastifyInstance,
  profileId: string,
  options: { limit?: number } = {}
): Promise<NotificationResponse[]> {
  const rows = await app.db
    .select(notificationSelection)
    .from(notifications)
    .leftJoin(actorProfiles, eq(notifications.actorProfileId, actorProfiles.id))
    .where(eq(notifications.recipientProfileId, profileId))
    .orderBy(desc(notifications.createdAt))
    .limit(options.limit ?? 50);

  return rows.map(mapNotification);
}

export async function getUnreadNotificationCount(
  app: FastifyInstance,
  profileId: string
): Promise<number> {
  const [row] = await app.db
    .select({
      count: sql<number>`count(*)::int`
    })
    .from(notifications)
    .where(and(eq(notifications.recipientProfileId, profileId), isNull(notifications.readAt)));

  return row?.count ?? 0;
}

export async function markNotificationRead(
  app: FastifyInstance,
  profileId: string,
  notificationId: string
): Promise<NotificationResponse | null> {
  const readAt = new Date();
  const [updatedNotification] = await app.db
    .update(notifications)
    .set({ readAt })
    .where(and(eq(notifications.id, notificationId), eq(notifications.recipientProfileId, profileId)))
    .returning({
      id: notifications.id
    });

  if (!updatedNotification) {
    return null;
  }

  return getNotificationForProfile(app, profileId, updatedNotification.id);
}

export async function markAllNotificationsRead(
  app: FastifyInstance,
  profileId: string
): Promise<number> {
  const updatedNotifications = await app.db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.recipientProfileId, profileId), isNull(notifications.readAt)))
    .returning({
      id: notifications.id
    });

  return updatedNotifications.length;
}

async function getNotificationForProfile(
  app: FastifyInstance,
  profileId: string,
  notificationId: string
): Promise<NotificationResponse | null> {
  const [row] = await app.db
    .select(notificationSelection)
    .from(notifications)
    .leftJoin(actorProfiles, eq(notifications.actorProfileId, actorProfiles.id))
    .where(and(eq(notifications.id, notificationId), eq(notifications.recipientProfileId, profileId)))
    .limit(1);

  return row ? mapNotification(row) : null;
}

const notificationSelection = {
  id: notifications.id,
  recipientProfileId: notifications.recipientProfileId,
  actorProfileId: notifications.actorProfileId,
  actorDisplayName: actorProfiles.displayName,
  type: notifications.type,
  title: notifications.title,
  body: notifications.body,
  entityType: notifications.entityType,
  entityId: notifications.entityId,
  metadata: notifications.metadata,
  readAt: notifications.readAt,
  createdAt: notifications.createdAt
};

function mapNotification(row: NotificationRow): NotificationResponse {
  return {
    id: row.id,
    recipientProfileId: row.recipientProfileId,
    actorProfile: row.actorProfileId
      ? {
          id: row.actorProfileId,
          displayName: row.actorDisplayName ?? ""
        }
      : null,
    type: row.type,
    title: row.title,
    body: row.body,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString()
  };
}

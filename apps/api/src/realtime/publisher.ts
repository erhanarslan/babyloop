import {
  REALTIME_EVENTS,
  realtimeConversationRoom,
  realtimeProfileRoom,
  type ConversationUpdatedPayload,
  type MessageCreatedPayload,
  type NotificationCreatedPayload,
  type NotificationReadAllPayload,
  type NotificationReadPayload,
  type NotificationUnreadCountUpdatedPayload,
  type RealtimeNotification
} from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  getConversationSummaryForProfile,
  listConversationParticipantProfileIds,
  type MessageResponse
} from "../services/messaging.service.js";

export async function publishPersistedMessage(
  app: FastifyInstance,
  conversationId: string,
  message: MessageResponse
): Promise<void> {
  emitMessageCreated(app, {
    conversationId,
    message
  });

  try {
    const participantProfileIds = await listConversationParticipantProfileIds(app, conversationId);

    await Promise.all(
      participantProfileIds.map(async (profileId) => {
        const conversation = await getConversationSummaryForProfile(app, conversationId, profileId);

        if (!conversation) {
          return;
        }

        emitConversationUpdated(app, profileId, {
          conversationId,
          conversation
        });
      })
    );
  } catch (error) {
    app.log.warn({ error, conversationId }, "Realtime conversation update publish failed.");
  }
}

export function emitMessageCreated(
  app: FastifyInstance,
  payload: MessageCreatedPayload
): void {
  try {
    app.realtime?.io
      .to(realtimeConversationRoom(payload.conversationId))
      .emit(REALTIME_EVENTS.messageCreated, payload);
  } catch (error) {
    app.log.warn({ error, conversationId: payload.conversationId }, "Realtime message publish failed.");
  }
}

export function emitConversationUpdated(
  app: FastifyInstance,
  profileId: string,
  payload: ConversationUpdatedPayload
): void {
  try {
    app.realtime?.io
      .to(realtimeProfileRoom(profileId))
      .emit(REALTIME_EVENTS.conversationUpdated, payload);
  } catch (error) {
    app.log.warn({ error, conversationId: payload.conversationId, profileId }, "Realtime conversation publish failed.");
  }
}

export async function publishNotificationCreated(
  app: FastifyInstance,
  recipientProfileId: string,
  payload: NotificationCreatedPayload
): Promise<void> {
  emitNotificationCreated(app, recipientProfileId, payload);
  emitUnreadNotificationCountUpdated(app, recipientProfileId, {
    unreadCount: payload.unreadCount
  });
}

export function emitNotificationCreated(
  app: FastifyInstance,
  profileId: string,
  payload: NotificationCreatedPayload
): void {
  try {
    app.realtime?.io
      .to(realtimeProfileRoom(profileId))
      .emit(REALTIME_EVENTS.notificationCreated, payload);
  } catch (error) {
    app.log.warn({ error, notificationId: payload.notification.id, profileId }, "Realtime notification publish failed.");
  }
}

export function emitNotificationRead(
  app: FastifyInstance,
  profileId: string,
  payload: NotificationReadPayload
): void {
  try {
    app.realtime?.io
      .to(realtimeProfileRoom(profileId))
      .emit(REALTIME_EVENTS.notificationRead, payload);
  } catch (error) {
    app.log.warn({ error, notificationId: payload.notificationId, profileId }, "Realtime notification read publish failed.");
  }
}

export function emitNotificationReadAll(
  app: FastifyInstance,
  profileId: string,
  payload: NotificationReadAllPayload
): void {
  try {
    app.realtime?.io
      .to(realtimeProfileRoom(profileId))
      .emit(REALTIME_EVENTS.notificationReadAll, payload);
  } catch (error) {
    app.log.warn({ error, profileId }, "Realtime notification read-all publish failed.");
  }
}

export function emitUnreadNotificationCountUpdated(
  app: FastifyInstance,
  profileId: string,
  payload: NotificationUnreadCountUpdatedPayload
): void {
  try {
    app.realtime?.io
      .to(realtimeProfileRoom(profileId))
      .emit(REALTIME_EVENTS.notificationUnreadCountUpdated, payload);
  } catch (error) {
    app.log.warn({ error, profileId }, "Realtime notification unread count publish failed.");
  }
}

export function toNotificationCreatedPayload(
  notification: RealtimeNotification,
  unreadCount: number
): NotificationCreatedPayload {
  return {
    notification,
    unreadCount
  };
}

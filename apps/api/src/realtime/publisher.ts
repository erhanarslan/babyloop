import {
  REALTIME_EVENTS,
  realtimeConversationRoom,
  realtimeProfileRoom,
  type ConversationUpdatedPayload,
  type MessageCreatedPayload
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

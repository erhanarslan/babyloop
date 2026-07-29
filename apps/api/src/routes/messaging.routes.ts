import { moderateMessageBody, type ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import {
  conversationParamsSchema,
  createConversationBodySchema,
  sendMessageBodySchema
} from "../schemas/messaging.schemas.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  createOrGetConversation,
  getConversationNotificationContext,
  getConversationForProfile,
  listConversationParticipantProfileIds,
  listConversationsForProfile,
  listMessagesForConversation,
  markConversationReadForProfile,
  sendMessage,
  type ConversationSummaryResponse,
  type MessageResponse
} from "../services/messaging.service.js";
import {
  emitConversationUpdated,
  emitNotificationRead,
  emitUnreadNotificationCountUpdated,
  publishNotificationCreated,
  publishPersistedMessage,
  toNotificationCreatedPayload
} from "../realtime/publisher.js";
import {
  createNotification,
  getUnreadNotificationCount,
  markMessageNotificationsReadForConversation
} from "../services/notifications.service.js";
import { recordProductEvent } from "../services/product-events.service.js";
import { trackServerAnalyticsEvent } from "../services/product-analytics.service.js";
import { safePlainTextFallback } from "../services/text-safety.service.js";
import { createMarketplaceEmailNotificationCandidate } from "../services/marketplace-email-notification.service.js";

type ConversationResponse = ApiResponse<{
  conversation: ConversationSummaryResponse;
}>;

type ConversationsResponse = ApiResponse<{
  conversations: ConversationSummaryResponse[];
}>;

type MessagesResponse = ApiResponse<{
  messages: MessageResponse[];
}>;

type ConversationReadResponse = ApiResponse<{
  conversation: ConversationSummaryResponse;
  unreadConversationCount: number;
  unreadNotificationCount: number;
}>;

type SendMessageResponse = ApiResponse<{
  message: MessageResponse;
}>;

type ConversationParams = {
  id: string;
};

export function registerMessagingRoutes(app: FastifyInstance): void {
  app.post<{ Body: unknown; Reply: ConversationResponse }>(
    "/conversations",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedBody = createConversationBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidMessagingRequest("Conversation request body is invalid."));
      }

      const result = await createOrGetConversation(app, currentUser, parsedBody.data);

      if (result.status === "invalid_listing") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_LISTING",
            message: "Listing does not exist."
          }
        });
      }

      if (result.status === "cannot_message_self") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "CANNOT_MESSAGE_SELF",
            message: "You cannot start a conversation for your own listing."
          }
        });
      }

      if (result.status === "demo_listing") {
        return reply.status(409).send({
          ok: false,
          error: {
            code: "DEMO_LISTING_MESSAGING_DISABLED",
            message: "Demo listings cannot receive messages."
          }
        });
      }

      if (result.status === "profile_blocked") {
        return reply.status(403).send(profileBlockedResponse());
      }

      if (result.status === "profile_not_allowed") {
        return reply.status(403).send(profileNotAllowedToMessageResponse());
      }

      if (result.status !== "created" && result.status !== "existing") {
        return reply.status(500).send({
          ok: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal server error"
          }
        });
      }
      if (result.status === "created") {
        void trackServerAnalyticsEvent(app, {
          eventName: "conversation_started",
          platform: "web",
          profileId: currentUser.profile.id,
          properties: {
            conversationId: result.conversation.id,
            listingId: parsedBody.data.listingId,
            sourceSurface: "listing_detail"
          },
          sessionId: currentUser.sessionId,
          userId: currentUser.userId
        });
      }

      return reply.status(result.status === "created" ? 201 : 200).send({
        ok: true,
        data: {
          conversation: result.conversation
        }
      });
    }
  );

  app.get<{ Reply: ConversationsResponse }>("/conversations", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return {
      ok: true,
      data: {
        conversations: await listConversationsForProfile(app, currentUser.profile.id)
      }
    };
  });

  app.get<{ Params: ConversationParams; Reply: ConversationResponse }>(
    "/conversations/:id",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = conversationParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidMessagingRequest("Conversation id must be a valid UUID."));
      }

      const result = await getConversationForProfile(
        app,
        parsedParams.data.id,
        currentUser.profile.id
      );

      if (result.status !== "ok") {
        return reply.status(result.status === "not_found" ? 404 : 403).send(accessError(result.status));
      }

      return {
        ok: true,
        data: {
          conversation: result.conversation
        }
      };
    }
  );

  app.get<{ Params: ConversationParams; Reply: MessagesResponse }>(
    "/conversations/:id/messages",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = conversationParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidMessagingRequest("Conversation id must be a valid UUID."));
      }

      const result = await listMessagesForConversation(app, currentUser, parsedParams.data.id);

      if (result.status !== "ok") {
        return reply.status(result.status === "not_found" ? 404 : 403).send(accessError(result.status));
      }

      return {
        ok: true,
        data: {
          messages: result.messages
        }
      };
    }
  );

  app.patch<{ Params: ConversationParams; Reply: ConversationReadResponse }>(
    "/conversations/:id/read",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = conversationParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidMessagingRequest("Conversation id must be a valid UUID."));
      }

      const readState = await markThreadRead(app, currentUser, parsedParams.data.id);

      if (!readState) {
        const accessResult = await getConversationForProfile(
          app,
          parsedParams.data.id,
          currentUser.profile.id
        );

        if (accessResult.status === "ok") {
          return reply.status(500).send({
            ok: false,
            error: {
              code: "INTERNAL_SERVER_ERROR",
              message: "Internal server error"
            }
          });
        }

        return reply.status(accessResult.status === "not_found" ? 404 : 403).send(accessError(accessResult.status));
      }

      return {
        ok: true,
        data: readState
      };
    }
  );

  app.post<{ Body: unknown; Params: ConversationParams; Reply: SendMessageResponse }>(
    "/conversations/:id/messages",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = conversationParamsSchema.safeParse(request.params);
      const parsedBody = sendMessageBodySchema.safeParse(request.body);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidMessagingRequest("Conversation id must be a valid UUID."));
      }

      if (!parsedBody.success) {
        return reply.status(400).send(invalidMessageBodyRequest());
      }

      const moderation = moderateMessageBody(parsedBody.data.body);

      if (!moderation.allowed) {
        return reply.status(400).send(messageBlockedResponse());
      }

      const result = await sendMessage(app, currentUser, parsedParams.data.id, parsedBody.data);

      if (result.status !== "sent") {
        if (result.status === "profile_blocked") {
          return reply.status(403).send(profileBlockedResponse());
        }

        if (result.status === "profile_not_allowed") {
          return reply.status(403).send(profileNotAllowedToMessageResponse());
        }

        return reply.status(result.status === "not_found" ? 404 : 403).send(accessError(result.status));
      }

      await createMessageReceivedNotifications(app, {
        conversationId: parsedParams.data.id,
        message: result.message,
        senderDisplayName: currentUser.profile.displayName,
        senderProfileId: currentUser.profile.id
      });
      await publishPersistedMessage(app, parsedParams.data.id, result.message);
      await recordProductEvent(app, {
        actorProfileId: currentUser.profile.id,
        eventType: "message_sent",
        conversationId: parsedParams.data.id,
        source: "conversation"
      }).catch(() => undefined);
      void trackServerAnalyticsEvent(app, {
        eventName: "message_sent",
        platform: "web",
        profileId: currentUser.profile.id,
        properties: {
          bodyLengthBucket: bucketMessageLength(parsedBody.data.body.length),
          conversationId: parsedParams.data.id,
          moderationOutcome: "allowed",
          sourceSurface: "conversation"
        },
        sessionId: currentUser.sessionId,
        userId: currentUser.userId
      });

      return reply.status(201).send({
        ok: true,
        data: {
          message: result.message
        }
      });
    }
  );
}

async function markThreadRead(
  app: FastifyInstance,
  currentUser: CurrentUser,
  conversationId: string
): Promise<{
  conversation: ConversationSummaryResponse;
  unreadConversationCount: number;
  unreadNotificationCount: number;
} | null> {
  const [readResult, readNotifications] = await Promise.all([
    markConversationReadForProfile(app, currentUser, conversationId),
    markMessageNotificationsReadForConversation(app, currentUser.profile.id, conversationId)
  ]);

  if (readResult.status !== "ok") {
    return null;
  }

  const unreadNotificationCount = await getUnreadNotificationCount(app, currentUser.profile.id);

  emitConversationUpdated(app, currentUser.profile.id, {
    conversationId,
    conversation: readResult.conversation
  });

  for (const notification of readNotifications) {
    emitNotificationRead(app, currentUser.profile.id, {
      notificationId: notification.id,
      readAt: notification.readAt,
      unreadCount: unreadNotificationCount
    });
  }

  emitUnreadNotificationCountUpdated(app, currentUser.profile.id, {
    unreadCount: unreadNotificationCount
  });

  return {
    conversation: readResult.conversation,
    unreadConversationCount: readResult.unreadConversationCount,
    unreadNotificationCount
  };
}

function messageBlockedResponse(): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: "MESSAGE_BLOCKED",
      message: "Message was blocked by moderation."
    }
  };
}

async function createMessageReceivedNotifications(
  app: FastifyInstance,
  input: {
    conversationId: string;
    message: MessageResponse;
    senderDisplayName: string;
    senderProfileId: string;
  }
): Promise<void> {
  const [participantProfileIds, contextListing] = await Promise.all([
    listConversationParticipantProfileIds(app, input.conversationId),
    getConversationNotificationContext(app, input.conversationId)
  ]);
  const senderDisplayName = safePlainTextFallback(input.senderDisplayName, "BabyLoop user", {
    maxLength: 120,
    minLength: 1
  });

  await Promise.all(
    participantProfileIds.map(async (recipientProfileId) => {
      const notification = await createNotification(app, {
        recipientProfileId,
        actorProfileId: input.senderProfileId,
        type: "message_received",
        title: "New message",
        body: `${senderDisplayName} sent you a new message.`,
        entityType: "conversation",
        entityId: input.conversationId,
        metadata: {
          ...(contextListing ? { listingId: contextListing.id } : {}),
          messageId: input.message.id
        }
      });

      if (!notification) {
        return;
      }

      const unreadCount = await getUnreadNotificationCount(app, recipientProfileId);
      await publishNotificationCreated(
        app,
        recipientProfileId,
        toNotificationCreatedPayload(notification, unreadCount)
      );
      await createMarketplaceEmailNotificationCandidate(app, {
        actionHref: `/conversations/${input.conversationId}`,
        kind: "message_received",
        metadata: {
          ...(contextListing ? { listingTitle: contextListing.title } : {}),
          senderDisplayName
        },
        profileId: recipientProfileId,
        sourceId: input.message.id
      }).catch((error: unknown) => {
        app.log.warn(error, "Failed to create message-received email candidate.");
      });
    })
  );
}

function truncateNotificationText(input: string): string {
  return input.length > 120 ? `${input.slice(0, 117)}...` : input;
}

function bucketMessageLength(length: number): string {
  if (length <= 50) {
    return "1-50";
  }

  if (length <= 200) {
    return "51-200";
  }

  return "201+";
}

function invalidMessageBodyRequest(): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: "INVALID_MESSAGE_BODY",
      message: "Message body must be safe plaintext."
    }
  };
}

function invalidMessagingRequest(message: string): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}

function accessError(status: "not_found" | "forbidden"): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: status === "not_found" ? "NOT_FOUND" : "FORBIDDEN",
      message: status === "not_found"
        ? "Conversation was not found."
        : "You do not have access to this conversation."
    }
  };
}

function profileBlockedResponse(): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: "PROFILE_BLOCKED",
      message: "You cannot message this user."
    }
  };
}

function profileNotAllowedToMessageResponse(): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: "PROFILE_NOT_ALLOWED_TO_MESSAGE",
      message: "This profile cannot send messages right now."
    }
  };
}

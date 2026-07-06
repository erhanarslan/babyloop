import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { listNotificationDeliveryDrafts } from "../services/notification-delivery-drafts.service.js";
import {
  generateChildLifecycleNotifications,
  type ChildLifecycleNotificationGenerationResponse
} from "../services/child-lifecycle-notifications.service.js";
import {
  generateSavedSearchNotifications,
  type SavedSearchNotificationGenerationResponse
} from "../services/saved-search-notifications.service.js";
import { z } from "zod";
import { updateNotificationPreferenceBodySchema } from "../schemas/notification-preferences.schemas.js";
import {
  emitNotificationRead,
  emitNotificationReadAll,
  emitUnreadNotificationCountUpdated
} from "../realtime/publisher.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  getUnreadNotificationCount,
  listNotificationsForProfile,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationResponse
} from "../services/notifications.service.js";
import {
  listNotificationPreferencesForProfile,
  updateNotificationPreferenceForProfile,
  type NotificationPreferenceAuditEventResponse,
  type NotificationPreferenceResponse,
  type NotificationPreferencesSummary
} from "../services/notification-preferences.service.js";

type NotificationsResponse = ApiResponse<{
  notifications: NotificationResponse[];
}>;

type UnreadCountResponse = ApiResponse<{
  count: number;
}>;

type NotificationReadResponse = ApiResponse<{
  notification: NotificationResponse;
}>;

type ReadAllResponse = ApiResponse<{
  updatedCount: number;
}>;

type ChildLifecycleGenerationResponse = ApiResponse<ChildLifecycleNotificationGenerationResponse>;

type SavedSearchGenerationResponse = ApiResponse<SavedSearchNotificationGenerationResponse>;

type NotificationPreferencesResponse = ApiResponse<{
  preferences: NotificationPreferenceResponse[];
  recentAuditEvents: NotificationPreferenceAuditEventResponse[];
  summary: NotificationPreferencesSummary;
}>;

type NotificationPreferenceUpdateResponse = ApiResponse<{
  preference: NotificationPreferenceResponse;
  auditEvent: NotificationPreferenceAuditEventResponse;
  summary: NotificationPreferencesSummary;
}>;

type NotificationParams = {
  id: string;
};

const notificationParamsSchema = z.object({
  id: z.string().uuid()
});

export function registerNotificationRoutes(app: FastifyInstance): void {
  app.get<{ Reply: NotificationPreferencesResponse }>("/notification-preferences", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return {
      ok: true,
      data: await listNotificationPreferencesForProfile(app, currentUser.profile.id)
    };
  });

  app.patch<{ Body: unknown; Reply: NotificationPreferenceUpdateResponse }>(
    "/notification-preferences",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedBody = updateNotificationPreferenceBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_NOTIFICATION_PREFERENCE_REQUEST",
            message: "Notification preference request is invalid."
          }
        });
      }

      return {
        ok: true,
        data: await updateNotificationPreferenceForProfile(
          app,
          currentUser.profile.id,
          currentUser.profile.id,
          parsedBody.data
        )
      };
    }
  );

  app.get("/notifications/delivery-drafts", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return {
      ok: true,
      data: await listNotificationDeliveryDrafts(app, currentUser.profile.id)
    };
  });

  app.post<{ Reply: ChildLifecycleGenerationResponse }>(
    "/notifications/child-lifecycle/generate",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      return {
        ok: true,
        data: await generateChildLifecycleNotifications(app, currentUser.profile.id)
      };
    }
  );

  app.post<{ Reply: SavedSearchGenerationResponse }>(
    "/notifications/saved-searches/generate",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      return {
        ok: true,
        data: await generateSavedSearchNotifications(app, currentUser.profile.id)
      };
    }
  );

  app.get<{ Reply: NotificationsResponse }>("/notifications", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return {
      ok: true,
      data: {
        notifications: await listNotificationsForProfile(app, currentUser.profile.id)
      }
    };
  });

  app.get<{ Reply: UnreadCountResponse }>("/notifications/unread-count", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return {
      ok: true,
      data: {
        count: await getUnreadNotificationCount(app, currentUser.profile.id)
      }
    };
  });

  app.patch<{ Params: NotificationParams; Reply: NotificationReadResponse }>(
    "/notifications/:id/read",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = notificationParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidNotificationRequest());
      }

      const notification = await markNotificationRead(
        app,
        currentUser.profile.id,
        parsedParams.data.id
      );

      if (!notification || !notification.readAt) {
        return reply.status(404).send(notificationNotFound());
      }

      const unreadCount = await getUnreadNotificationCount(app, currentUser.profile.id);
      emitNotificationRead(app, currentUser.profile.id, {
        notificationId: notification.id,
        readAt: notification.readAt,
        unreadCount
      });
      emitUnreadNotificationCountUpdated(app, currentUser.profile.id, {
        unreadCount
      });

      return {
        ok: true,
        data: {
          notification
        }
      };
    }
  );

  app.patch<{ Reply: ReadAllResponse }>("/notifications/read-all", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const updatedCount = await markAllNotificationsRead(app, currentUser.profile.id);
    const unreadCount = await getUnreadNotificationCount(app, currentUser.profile.id);

    emitNotificationReadAll(app, currentUser.profile.id, {
      updatedCount,
      unreadCount
    });
    emitUnreadNotificationCountUpdated(app, currentUser.profile.id, {
      unreadCount
    });

    return {
      ok: true,
      data: {
        updatedCount
      }
    };
  });
}

function invalidNotificationRequest(): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message: "Notification id must be a valid UUID."
    }
  };
}

function notificationNotFound(): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: "NOT_FOUND",
      message: "Notification was not found."
    }
  };
}

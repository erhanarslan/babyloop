import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { listNotificationDeliveryDrafts } from "../services/notification-delivery-drafts.service.js";
import { z } from "zod";
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

type NotificationParams = {
  id: string;
};

const notificationParamsSchema = z.object({
  id: z.string().uuid()
});

export function registerNotificationRoutes(app: FastifyInstance): void {
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

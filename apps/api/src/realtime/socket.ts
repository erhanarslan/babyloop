import {
  REALTIME_EVENTS,
  realtimeConversationRoom,
  realtimeProfileRoom,
  type RealtimeClientToServerEvents,
  type RealtimeErrorCode,
  type RealtimeErrorPayload,
  type RealtimeServerToClientEvents
} from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { Server, type Socket } from "socket.io";
import { conversationParamsSchema } from "../schemas/messaging.schemas.js";
import { getConversationForProfile } from "../services/messaging.service.js";
import {
  authenticateAccessToken,
  type CurrentUser
} from "../plugins/auth.plugin.js";

export type RealtimeServer = Server<
  RealtimeClientToServerEvents,
  RealtimeServerToClientEvents,
  Record<string, never>,
  RealtimeSocketData
>;

export type RealtimeHub = {
  io: RealtimeServer;
};

type RealtimeSocket = Socket<
  RealtimeClientToServerEvents,
  RealtimeServerToClientEvents,
  Record<string, never>,
  RealtimeSocketData
>;

type RealtimeSocketData = {
  currentUser: CurrentUser;
};

type RealtimeOptions = {
  authSecret: string;
  corsOrigins: string[];
};

export function registerRealtime(app: FastifyInstance, options: RealtimeOptions): void {
  const io: RealtimeServer = new Server(app.server, {
    cors: {
      credentials: true,
      origin: options.corsOrigins
    }
  });

  io.use(async (socket, next) => {
    const token = readSocketAccessToken(socket);

    if (!token) {
      next(connectionError("AUTH_REQUIRED"));
      return;
    }

    const currentUser = await authenticateAccessToken(app, token, {
      authSecret: options.authSecret
    });

    if (!currentUser) {
      next(connectionError("AUTH_REQUIRED"));
      return;
    }

    socket.data.currentUser = currentUser;
    next();
  });

  io.on("connection", (socket) => {
    const currentUser = socket.data.currentUser;

    socket.join(realtimeProfileRoom(currentUser.profile.id));

    socket.on(REALTIME_EVENTS.conversationJoin, (payload) => {
      void handleConversationJoin(app, socket, payload);
    });

    socket.on(REALTIME_EVENTS.conversationLeave, (payload) => {
      const parsedPayload = conversationParamsSchema.safeParse({
        id: payload?.conversationId
      });

      if (!parsedPayload.success) {
        emitRealtimeError(socket, "INVALID_PAYLOAD");
        return;
      }

      socket.leave(realtimeConversationRoom(parsedPayload.data.id));
    });
  });

  app.decorate("realtime", {
    io
  });

  app.addHook("onClose", (_instance, done) => {
    io.close(() => done());
  });
}

async function handleConversationJoin(
  app: FastifyInstance,
  socket: RealtimeSocket,
  payload: { conversationId: string }
): Promise<void> {
  const parsedPayload = conversationParamsSchema.safeParse({
    id: payload?.conversationId
  });

  if (!parsedPayload.success) {
    emitRealtimeError(socket, "INVALID_PAYLOAD");
    return;
  }

  try {
    const result = await getConversationForProfile(
      app,
      parsedPayload.data.id,
      socket.data.currentUser.profile.id
    );

    if (result.status !== "ok") {
      emitRealtimeError(socket, result.status === "not_found" ? "NOT_FOUND" : "FORBIDDEN");
      return;
    }

    socket.join(realtimeConversationRoom(parsedPayload.data.id));
  } catch {
    emitRealtimeError(socket, "SERVER_ERROR");
  }
}

function readSocketAccessToken(socket: RealtimeSocket): string | null {
  const authToken = socket.handshake.auth?.token;

  if (typeof authToken === "string" && authToken.trim()) {
    return authToken;
  }

  const authorization = socket.handshake.headers.authorization;

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  return scheme === "Bearer" && token ? token : null;
}

function emitRealtimeError(socket: RealtimeSocket, code: RealtimeErrorCode): void {
  socket.emit(REALTIME_EVENTS.realtimeError, realtimeError(code));
}

function connectionError(code: RealtimeErrorCode): Error {
  const error = new Error(code) as Error & {
    data?: RealtimeErrorPayload;
  };
  error.data = realtimeError(code);

  return error;
}

function realtimeError(code: RealtimeErrorCode): RealtimeErrorPayload {
  return {
    code,
    message: realtimeErrorMessage(code)
  };
}

function realtimeErrorMessage(code: RealtimeErrorCode): string {
  if (code === "FORBIDDEN") {
    return "You do not have access to this conversation.";
  }

  if (code === "INVALID_PAYLOAD") {
    return "Realtime payload is invalid.";
  }

  if (code === "NOT_FOUND") {
    return "Conversation was not found.";
  }

  if (code === "SERVER_ERROR") {
    return "Realtime server error.";
  }

  return "Authentication is required.";
}

import type { ApiFailure } from "@babyloop/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";

export async function requireCurrentUser(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<CurrentUser | null> {
  if (typeof app.authenticate !== "function") {
    reply.status(503).send(authUnavailable());
    return null;
  }

  const currentUser = await app.authenticate(request);

  if (!currentUser) {
    reply.status(401).send(authenticationRequired());
    return null;
  }

  return currentUser;
}

export function authenticationRequired(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication is required."
    }
  };
}

export function authUnavailable(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "AUTH_UNAVAILABLE",
      message: "Authentication is unavailable."
    }
  };
}


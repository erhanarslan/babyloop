import type { ApiFailure } from "@babyloop/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireCurrentUser } from "./auth-context.service.js";
import type { CurrentUser } from "../plugins/auth.plugin.js";

export async function requireAdminUser(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<CurrentUser | null> {
  const currentUser = await requireCurrentUser(app, request, reply);

  if (!currentUser) {
    return null;
  }

  if (currentUser.role !== "admin") {
    reply.status(403).send(adminForbidden());
    return null;
  }

  return currentUser;
}

export function adminForbidden(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message: "Admin access is required."
    }
  };
}
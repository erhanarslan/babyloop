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

export async function requireSensitiveDataAccess(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<CurrentUser | null> {
  const admin = await requireAdminUser(app, request, reply);

  if (!admin) {
    return null;
  }

  // Compatibility gate: today only admin users can request raw sensitive data.
  // Keep this isolated so granular permissions can replace it without route churn.
  if (!hasSensitiveDataAccess(admin)) {
    reply.status(403).send(adminForbidden());
    return null;
  }

  return admin;
}

export function hasSensitiveDataAccess(currentUser: CurrentUser): boolean {
  // Compatibility gate: today only admin users can request raw sensitive data.
  // Keep this isolated so granular permissions can replace it without route churn.
  return currentUser.role === "admin";
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

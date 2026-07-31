import type { ApiFailure } from "@babyloop/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireCurrentUser } from "./auth-context.service.js";
import type { CurrentUser } from "../plugins/auth.plugin.js";

export const BACKOFFICE_PERMISSIONS = [
  "dashboard_view",
  "moderation_view",
  "moderation_enforce",
  "sensitive_access",
  "listing_view",
  "listing_review",
  "profile_view",
  "profile_enforce",
  "conversation_view",
  "audit_view",
  "ai_ops_view",
  "ai_generate"
] as const;

export type BackofficePermission = (typeof BACKOFFICE_PERMISSIONS)[number];

const ADMIN_BACKOFFICE_PERMISSIONS = new Set<BackofficePermission>(
  BACKOFFICE_PERMISSIONS
);

const MODERATOR_BACKOFFICE_PERMISSIONS = new Set<BackofficePermission>([
  "dashboard_view",
  "moderation_view",
  "moderation_enforce",
  "listing_view",
  "listing_review",
  "profile_view",
  "profile_enforce",
  "conversation_view",
  "ai_generate"
]);

const SUPPORT_BACKOFFICE_PERMISSIONS = new Set<BackofficePermission>([
  "dashboard_view",
  "moderation_view",
  "profile_view",
  "conversation_view"
]);

const EMPTY_BACKOFFICE_PERMISSIONS = new Set<BackofficePermission>();

const VIEWER_BACKOFFICE_PERMISSIONS = new Set<BackofficePermission>([
  "dashboard_view",
  "listing_view",
  "profile_view",
]);

const PREVIEW_BACKOFFICE_PERMISSIONS = new Set<BackofficePermission>([
  "listing_view",
  "profile_view"
]);

const ROLE_BACKOFFICE_PERMISSIONS: Record<string, ReadonlySet<BackofficePermission>> = {
  admin: ADMIN_BACKOFFICE_PERMISSIONS,
  moderator: MODERATOR_BACKOFFICE_PERMISSIONS,
  support: SUPPORT_BACKOFFICE_PERMISSIONS,
  backoffice_viewer: VIEWER_BACKOFFICE_PERMISSIONS
};

export function getBackofficePermissionsForRole(
  role: string
): ReadonlySet<BackofficePermission> {
  return ROLE_BACKOFFICE_PERMISSIONS[role.toLowerCase()] ?? EMPTY_BACKOFFICE_PERMISSIONS;
}

export function hasBackofficePermission(
  currentUser: CurrentUser,
  permission: BackofficePermission
): boolean {
  if (currentUser.backofficeAccessMode === "preview") {
    return PREVIEW_BACKOFFICE_PERMISSIONS.has(permission);
  }

  return getBackofficePermissionsForRole(currentUser.role).has(permission);
}

export function isBackofficePreviewPrincipal(currentUser: CurrentUser): boolean {
  return currentUser.backofficeAccessMode === "preview";
}

export function isBackofficeReadOnlyPrincipal(currentUser: CurrentUser): boolean {
  return (
    isBackofficePreviewPrincipal(currentUser) ||
    currentUser.role.toLowerCase() === "backoffice_viewer"
  );
}

export function isBackofficeRole(role: string): boolean {
  return getBackofficePermissionsForRole(role).size > 0;
}

export async function requireBackofficePermission(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  permission: BackofficePermission
): Promise<CurrentUser | null> {
  const currentUser = await requireCurrentUser(app, request, reply);

  if (!currentUser) {
    return null;
  }

  if (!hasBackofficePermission(currentUser, permission)) {
    reply.status(403).send(adminForbidden());
    return null;
  }

  return currentUser;
}

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
  return requireBackofficePermission(app, request, reply, "sensitive_access");
}

export function hasSensitiveDataAccess(currentUser: CurrentUser): boolean {
  return hasBackofficePermission(currentUser, "sensitive_access");
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

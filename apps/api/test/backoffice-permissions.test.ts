import { describe, expect, it } from "vitest";
import {
  BACKOFFICE_PERMISSIONS,
  getBackofficePermissionsForRole,
  hasBackofficePermission,
  isBackofficeRole
} from "../src/services/admin-context.service.js";
import type { CurrentUser } from "../src/plugins/auth.plugin.js";

function currentUserWithRole(role: string): CurrentUser {
  return {
    userId: "00000000-0000-0000-0000-000000000001",
    email: "admin@example.com",
    emailVerifiedAt: null,
    role,
    profile: {
      id: "00000000-0000-0000-0000-000000000002",
      displayName: "Admin User",
      city: null,
      district: null
    }
  };
}

describe("backoffice permissions", () => {
  it("grants every backoffice permission to admins", () => {
    const permissions = getBackofficePermissionsForRole("admin");

    for (const permission of BACKOFFICE_PERMISSIONS) {
      expect(permissions.has(permission)).toBe(true);
      expect(hasBackofficePermission(currentUserWithRole("admin"), permission)).toBe(true);
    }
  });

  it("grants operational permissions to moderators without sensitive access", () => {
    const moderator = currentUserWithRole("moderator");

    expect(hasBackofficePermission(moderator, "dashboard_view")).toBe(true);
    expect(hasBackofficePermission(moderator, "moderation_view")).toBe(true);
    expect(hasBackofficePermission(moderator, "moderation_enforce")).toBe(true);
    expect(hasBackofficePermission(moderator, "listing_review")).toBe(true);
    expect(hasBackofficePermission(moderator, "profile_view")).toBe(true);
    expect(hasBackofficePermission(moderator, "profile_enforce")).toBe(true);
    expect(hasBackofficePermission(moderator, "conversation_view")).toBe(true);
    expect(hasBackofficePermission(moderator, "ai_generate")).toBe(true);

    expect(hasBackofficePermission(moderator, "sensitive_access")).toBe(false);
    expect(hasBackofficePermission(moderator, "audit_view")).toBe(false);
    expect(hasBackofficePermission(moderator, "ai_ops_view")).toBe(false);
  });

  it("keeps support users view-only", () => {
    const support = currentUserWithRole("support");

    expect(hasBackofficePermission(support, "dashboard_view")).toBe(true);
    expect(hasBackofficePermission(support, "moderation_view")).toBe(true);
    expect(hasBackofficePermission(support, "profile_view")).toBe(true);
    expect(hasBackofficePermission(support, "conversation_view")).toBe(true);

    expect(hasBackofficePermission(support, "moderation_enforce")).toBe(false);
    expect(hasBackofficePermission(support, "sensitive_access")).toBe(false);
    expect(hasBackofficePermission(support, "listing_review")).toBe(false);
    expect(hasBackofficePermission(support, "profile_enforce")).toBe(false);
    expect(hasBackofficePermission(support, "audit_view")).toBe(false);
    expect(hasBackofficePermission(support, "ai_ops_view")).toBe(false);
    expect(hasBackofficePermission(support, "ai_generate")).toBe(false);
  });

  it("detects roles that can authenticate to backoffice", () => {
    expect(isBackofficeRole("admin")).toBe(true);
    expect(isBackofficeRole("moderator")).toBe(true);
    expect(isBackofficeRole("support")).toBe(true);
    expect(isBackofficeRole("backoffice_viewer")).toBe(true);
    expect(isBackofficeRole("user")).toBe(false);
    expect(isBackofficeRole("unknown")).toBe(false);
  });

  it("grants viewers only the minimal read-only permission set", () => {
    const viewer = currentUserWithRole("backoffice_viewer");

    expect(hasBackofficePermission(viewer, "dashboard_view")).toBe(true);
    expect(hasBackofficePermission(viewer, "listing_view")).toBe(true);
    expect(hasBackofficePermission(viewer, "profile_view")).toBe(true);

    for (const permission of [
      "listing_review",
      "profile_enforce",
      "moderation_view",
      "moderation_enforce",
      "sensitive_access",
      "conversation_view",
      "audit_view",
      "ai_ops_view",
      "ai_generate",
    ] as const) {
      expect(hasBackofficePermission(viewer, permission)).toBe(false);
    }
  });

  it("does not grant backoffice permissions to regular users", () => {
    const user = currentUserWithRole("user");

    for (const permission of BACKOFFICE_PERMISSIONS) {
      expect(hasBackofficePermission(user, permission)).toBe(false);
    }
  });
});

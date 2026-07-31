import { describe, expect, it } from "vitest";

import {
  isBackofficeUiPrincipal,
  isReadOnlyPathAllowed
} from "./backoffice-auth-shell";

function auth(accessMode: "preview" | "staff", role: string) {
  return {
    accessMode,
    user: {
      id: "user-1",
      email: "user@babyloop.test",
      role
    }
  };
}

describe("backoffice auth shell access contract", () => {
  it("accepts only a server-derived normal-user preview principal", () => {
    expect(isBackofficeUiPrincipal(auth("preview", "user"))).toBe(true);
    expect(isBackofficeUiPrincipal(auth("staff", "user"))).toBe(false);
    expect(isBackofficeUiPrincipal(auth("preview", "admin"))).toBe(false);
  });

  it("keeps the existing admin and viewer UI roles without expanding staff UI", () => {
    expect(isBackofficeUiPrincipal(auth("staff", "admin"))).toBe(true);
    expect(isBackofficeUiPrincipal(auth("staff", "backoffice_viewer"))).toBe(true);
    expect(isBackofficeUiPrincipal(auth("staff", "moderator"))).toBe(false);
    expect(isBackofficeUiPrincipal(auth("staff", "support"))).toBe(false);
  });

  it("allows only landing, listing and profile routes in read-only mode", () => {
    for (const path of [
      "/",
      "/listings",
      "/listings/listing-1",
      "/profiles",
      "/profiles/profile-1"
    ]) {
      expect(isReadOnlyPathAllowed(path), path).toBe(true);
    }

    for (const path of [
      "/analytics",
      "/audit",
      "/ai-ops",
      "/moderation",
      "/storage",
      "/notifications"
    ]) {
      expect(isReadOnlyPathAllowed(path), path).toBe(false);
    }
  });
});

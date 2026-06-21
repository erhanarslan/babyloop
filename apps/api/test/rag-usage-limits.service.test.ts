import { describe, expect, it } from "vitest";
import { RagUsageLimitService } from "../src/services/rag-usage-limits.service.js";
import type { CurrentUser } from "../src/plugins/auth.plugin.js";

const currentUser: CurrentUser = {
  email: "parent@example.test",
  emailVerifiedAt: null,
  profile: {
    displayName: "Ebeveyn",
    id: "profile-1",
    locationCity: "İstanbul"
  },
  role: "user",
  userId: "user-1"
};

const adminUser: CurrentUser = {
  ...currentUser,
  role: "admin",
  userId: "admin-1"
};

describe("rag usage limit service", () => {
  it("limits guest usage by configured hourly and daily count", async () => {
    const service = new RagUsageLimitService({
      adminBypass: true,
      backend: "memory",
      dailyGuestLimit: 2,
      dailyUserLimit: 10,
      enabled: true,
      hourlyGuestLimit: 2,
      hourlyUserLimit: 10,
      keyPrefix: "test:rag"
    });

    expect((await service.consume({ identifier: "ip:test", authenticated: false, scope: "assistant" })).allowed).toBe(true);
    expect((await service.consume({ identifier: "ip:test", authenticated: false, scope: "assistant" })).allowed).toBe(true);
    expect(await service.consume({ identifier: "ip:test", authenticated: false, scope: "assistant" })).toMatchObject({
      allowed: false,
      remaining: 0
    });
  });

  it("uses higher limits for authenticated users", async () => {
    const service = new RagUsageLimitService({
      adminBypass: true,
      backend: "memory",
      dailyGuestLimit: 1,
      dailyUserLimit: 2,
      enabled: true,
      hourlyGuestLimit: 1,
      hourlyUserLimit: 2,
      keyPrefix: "test:rag"
    });

    expect((await service.consume({ identifier: "user:test", authenticated: true, currentUser, scope: "assistant" })).allowed).toBe(true);
    expect((await service.consume({ identifier: "user:test", authenticated: true, currentUser, scope: "assistant" })).allowed).toBe(true);
    expect((await service.consume({ identifier: "user:test", authenticated: true, currentUser, scope: "assistant" })).allowed).toBe(false);
  });

  it("bypasses limits for admin users when configured", async () => {
    const service = new RagUsageLimitService({
      adminBypass: true,
      backend: "memory",
      dailyGuestLimit: 1,
      dailyUserLimit: 1,
      enabled: true,
      hourlyGuestLimit: 1,
      hourlyUserLimit: 1,
      keyPrefix: "test:rag"
    });

    expect((await service.consume({ identifier: "admin:test", authenticated: true, currentUser: adminUser, scope: "assistant" })).allowed).toBe(true);
    expect((await service.consume({ identifier: "admin:test", authenticated: true, currentUser: adminUser, scope: "assistant" })).allowed).toBe(true);
  });

  it("reports backend and configured limits", () => {
    const service = new RagUsageLimitService({
      adminBypass: true,
      backend: "memory",
      dailyGuestLimit: 20,
      dailyUserLimit: 100,
      enabled: true,
      hourlyGuestLimit: 10,
      hourlyUserLimit: 50,
      keyPrefix: "test:rag"
    });

    expect(service.summary()).toMatchObject({
      enabled: true,
      backend: "memory",
      backendEffective: "memory",
      limits: {
        hourlyGuest: 10,
        dailyGuest: 20,
        hourlyUser: 50,
        dailyUser: 100,
        adminBypass: true
      }
    });
  });
});

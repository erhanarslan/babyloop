import { describe, expect, it } from "vitest";
import { RagUsageLimitService } from "../src/services/rag-usage-limits.service.js";

describe("rag usage limit service", () => {
  it("limits guest usage by configured daily count", () => {
    const service = new RagUsageLimitService({
      dailyGuestLimit: 2,
      dailyUserLimit: 10
    });

    expect(service.consume({ key: "ip:test", authenticated: false }).allowed).toBe(true);
    expect(service.consume({ key: "ip:test", authenticated: false }).allowed).toBe(true);
    expect(service.consume({ key: "ip:test", authenticated: false })).toMatchObject({
      allowed: false,
      remaining: 0
    });
  });

  it("uses higher limits for authenticated users", () => {
    const service = new RagUsageLimitService({
      dailyGuestLimit: 1,
      dailyUserLimit: 2
    });

    expect(service.consume({ key: "user:test", authenticated: true }).allowed).toBe(true);
    expect(service.consume({ key: "user:test", authenticated: true }).allowed).toBe(true);
    expect(service.consume({ key: "user:test", authenticated: true }).allowed).toBe(false);
  });
});

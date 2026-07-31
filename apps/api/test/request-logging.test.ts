import { describe, expect, it } from "vitest";
import { shouldDisableDefaultRequestLogging } from "../src/app.js";

describe("sensitive request logging boundary", () => {
  it("suppresses raw Google callback URLs that can contain authorization codes", () => {
    expect(shouldDisableDefaultRequestLogging(
      "/api/v1/auth/google/callback?state=oauth-state&code=secret-authorization-code"
    )).toBe(true);
    expect(shouldDisableDefaultRequestLogging("/api/v1/auth/google/callback"))
      .toBe(true);
  });

  it("keeps default request logging enabled outside the exact callback route", () => {
    expect(shouldDisableDefaultRequestLogging("/api/v1/auth/google/start"))
      .toBe(false);
    expect(shouldDisableDefaultRequestLogging("/api/v1/auth/google/callback-extra?code=value"))
      .toBe(false);
  });

  it("suppresses backoffice OAuth start URLs that can carry a next query", () => {
    expect(shouldDisableDefaultRequestLogging(
      "/api/v1/auth/backoffice/google/start?next=%2Flistings%3Ftoken%3Dsecret"
    )).toBe(true);
  });
});

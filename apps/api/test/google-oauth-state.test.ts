import { describe, expect, it } from "vitest";
import {
  createGoogleOAuthState,
  resetGoogleOAuthReplayGuardForTests,
  resolveSafeBackofficeOAuthNext,
  verifyGoogleOAuthState
} from "../src/services/google-oauth.service.js";

const SECRET = "test-oauth-state-secret-at-least-32-chars";

describe("Google OAuth audience state", () => {
  it("authenticates audience and safe next with a bounded TTL", () => {
    const now = new Date("2026-07-31T12:00:00.000Z");
    const state = createGoogleOAuthState({ audience: "backoffice", authSecret: SECRET, next: "/listings?page=2", now });
    expect(verifyGoogleOAuthState(state, SECRET, { now })).toMatchObject({
      audience: "backoffice",
      next: "/listings?page=2"
    });
    expect(verifyGoogleOAuthState(state, SECRET, { now: new Date(now.getTime() + 601_000) })).toBeNull();
  });

  it("rejects tampering, wrong secrets, and replay", () => {
    resetGoogleOAuthReplayGuardForTests();
    const state = createGoogleOAuthState({ audience: "backoffice", authSecret: SECRET });
    expect(verifyGoogleOAuthState(`${state}x`, SECRET)).toBeNull();
    expect(verifyGoogleOAuthState(state, `${SECRET}-wrong`)).toBeNull();
    expect(verifyGoogleOAuthState(state, SECRET, { consume: true })).not.toBeNull();
    expect(verifyGoogleOAuthState(state, SECRET, { consume: true })).toBeNull();
  });

  it.each(["https://evil.example", "//evil.example", "%2F%2Fevil.example", "/login", "/auth/callback"])(
    "rejects unsafe or looping next path %s",
    (value) => expect(resolveSafeBackofficeOAuthNext(value)).toBe("/")
  );
});

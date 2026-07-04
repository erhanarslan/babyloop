import { afterEach, describe, expect, it } from "vitest";

import {
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  GOOGLE_OAUTH_STATE_COOKIE_PATH,
  serializeExpiredGoogleOAuthStateCookie,
  serializeGoogleOAuthStateCookie
} from "../src/services/google-oauth.service.js";

describe("Google OAuth state cookie", () => {
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  it("serializes the OAuth state cookie as httpOnly and scoped to the callback surface", () => {
    process.env.NODE_ENV = "test";

    const cookie = serializeGoogleOAuthStateCookie("state-value");

    expect(cookie).toContain(`${GOOGLE_OAUTH_STATE_COOKIE_NAME}=state-value`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain(`Path=${GOOGLE_OAUTH_STATE_COOKIE_PATH}`);
    expect(cookie).toContain("Max-Age=");
    expect(cookie).not.toContain("Secure");
  });

  it("adds Secure to active and expired OAuth state cookies in production", () => {
    process.env.NODE_ENV = "production";

    expect(serializeGoogleOAuthStateCookie("state-value")).toContain("Secure");
    expect(serializeExpiredGoogleOAuthStateCookie()).toContain("Secure");
  });
});

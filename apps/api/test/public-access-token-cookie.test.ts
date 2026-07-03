import { describe, expect, it } from "vitest";
import {
  PUBLIC_ACCESS_TOKEN_COOKIE_NAME,
  readPublicAccessTokenCookie,
  serializeExpiredPublicAccessTokenCookie,
  serializePublicAccessTokenCookie
} from "./src/utils/public-access-token-cookie.js";

describe("public access token cookie", () => {
  it("serializes an httpOnly same-site cookie scoped to the public app", () => {
    const cookie = serializePublicAccessTokenCookie("access.token.value", {
      maxAgeSeconds: 900
    });

    expect(cookie).toContain(`${PUBLIC_ACCESS_TOKEN_COOKIE_NAME}=access.token.value`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=900");
    expect(cookie).not.toContain("Secure");
  });

  it("adds Secure in production", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const activeCookie = serializePublicAccessTokenCookie("access.token.value", {
        maxAgeSeconds: 900
      });
      const expiredCookie = serializeExpiredPublicAccessTokenCookie();

      expect(activeCookie).toContain("Secure");
      expect(expiredCookie).toContain("Secure");
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it("reads only the explicit public access token cookie", () => {
    const cookie = [
      "other=value",
      `${PUBLIC_ACCESS_TOKEN_COOKIE_NAME}=encoded%20token`,
      "babyloop_refresh_token=refresh"
    ].join("; ");

    expect(readPublicAccessTokenCookie(cookie)).toBe("encoded token");
  });

  it("serializes an expired httpOnly cookie for logout", () => {
    const cookie = serializeExpiredPublicAccessTokenCookie();

    expect(cookie).toContain(`${PUBLIC_ACCESS_TOKEN_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=0");
  });
});

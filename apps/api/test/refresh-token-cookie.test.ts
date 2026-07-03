import { describe, expect, it } from "vitest";
import {
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_PATH,
  REFRESH_TOKEN_TTL_SECONDS,
  createRefreshToken,
  hashRefreshToken,
  readRefreshTokenCookie,
  serializeExpiredRefreshTokenCookie,
  serializeRefreshTokenCookie
} from "./src/utils/refresh-token.js";

describe("refresh token cookie", () => {
  it("creates and hashes refresh tokens without storing the raw token as the hash", () => {
    const token = createRefreshToken();
    const hash = hashRefreshToken(token);

    expect(token).toEqual(expect.any(String));
    expect(hash).toEqual(expect.any(String));
    expect(hash).not.toBe(token);
  });

  it("serializes an httpOnly refresh cookie scoped to the auth surface", () => {
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    const cookie = serializeRefreshTokenCookie("refresh.token.value", {
      expiresAt
    });

    expect(cookie).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=refresh.token.value`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain(`Path=${REFRESH_TOKEN_COOKIE_PATH}`);
    expect(cookie).toContain(`Max-Age=${REFRESH_TOKEN_TTL_SECONDS}`);
    expect(cookie).toContain("Expires=Tue, 01 Jan 2030 00:00:00 GMT");
    expect(cookie).not.toContain("Secure");
  });

  it("adds Secure in production", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const activeCookie = serializeRefreshTokenCookie("refresh.token.value", {
        expiresAt: new Date("2030-01-01T00:00:00.000Z")
      });
      const expiredCookie = serializeExpiredRefreshTokenCookie();

      expect(activeCookie).toContain("Secure");
      expect(expiredCookie).toContain("Secure");
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it("reads only the explicit refresh token cookie", () => {
    const cookie = [
      "other=value",
      `${REFRESH_TOKEN_COOKIE_NAME}=encoded%20refresh`,
      "babyloop_public_access_token=access"
    ].join("; ");

    expect(readRefreshTokenCookie(cookie)).toBe("encoded refresh");
  });

  it("serializes an expired httpOnly cookie for logout", () => {
    const cookie = serializeExpiredRefreshTokenCookie();

    expect(cookie).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain(`Path=${REFRESH_TOKEN_COOKIE_PATH}`);
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  });
});

import { describe, expect, it } from "vitest";
import {
  BACKOFFICE_REFRESH_TOKEN_COOKIE_NAME,
  BACKOFFICE_REFRESH_TOKEN_COOKIE_PATH,
  readBackofficeRefreshTokenCookie,
  serializeBackofficeRefreshTokenCookie,
  serializeExpiredBackofficeRefreshTokenCookie
} from "../src/utils/backoffice-refresh-token.js";

describe("backoffice refresh token cookie", () => {
  it("uses a distinct httpOnly cookie scoped to backoffice auth", () => {
    const cookie = serializeBackofficeRefreshTokenCookie("refresh.secret", {
      expiresAt: new Date("2026-08-30T00:00:00.000Z")
    });
    expect(cookie).toContain(`${BACKOFFICE_REFRESH_TOKEN_COOKIE_NAME}=refresh.secret`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain(`Path=${BACKOFFICE_REFRESH_TOKEN_COOKIE_PATH}`);
    expect(cookie).not.toContain("babyloop_refresh_token=");
    expect(readBackofficeRefreshTokenCookie(cookie)).toBe("refresh.secret");
  });

  it("expires only the backoffice refresh cookie", () => {
    expect(serializeExpiredBackofficeRefreshTokenCookie()).toContain("Max-Age=0");
  });
});

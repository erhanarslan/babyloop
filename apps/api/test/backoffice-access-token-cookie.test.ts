import { describe, expect, it } from "vitest";
import {
  BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME,
  readBackofficeAccessTokenCookie,
  serializeBackofficeAccessTokenCookie,
  serializeExpiredBackofficeAccessTokenCookie
} from "../src/utils/backoffice-access-token-cookie.js";

describe("backoffice access token cookie", () => {
  it("serializes an httpOnly cookie scoped to the backoffice API surface", () => {
    const cookie = serializeBackofficeAccessTokenCookie("access.token.value", {
      maxAgeSeconds: 900
    });

    expect(cookie).toContain(`${BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME}=access.token.value`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=900");
  });

  it("reads only the explicit backoffice access token cookie", () => {
    const cookie = [
      "other=value",
      `${BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME}=encoded%20token`,
      "babyloop_refresh_token=refresh"
    ].join("; ");

    expect(readBackofficeAccessTokenCookie(cookie)).toBe("encoded token");
    expect(readBackofficeAccessTokenCookie("other=value")).toBeNull();
  });

  it("serializes an expired httpOnly cookie for logout", () => {
    const cookie = serializeExpiredBackofficeAccessTokenCookie();

    expect(cookie).toContain(`${BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=0");
  });
});

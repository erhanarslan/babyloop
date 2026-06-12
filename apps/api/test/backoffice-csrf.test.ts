import { describe, expect, it } from "vitest";
import {
  BACKOFFICE_CSRF_COOKIE_NAME,
  BACKOFFICE_CSRF_HEADER_NAME,
  createBackofficeCsrfToken,
  isBackofficeCsrfRequestValid,
  readBackofficeCsrfCookie,
  serializeBackofficeCsrfCookie,
  serializeExpiredBackofficeCsrfCookie
} from "../src/utils/backoffice-csrf.js";

describe("backoffice csrf utility", () => {
  it("serializes a readable same-site CSRF cookie", () => {
    const cookie = serializeBackofficeCsrfCookie("csrf.token.value");

    expect(cookie).toContain(`${BACKOFFICE_CSRF_COOKIE_NAME}=csrf.token.value`);
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=");
    expect(cookie).not.toContain("HttpOnly");
  });

  it("reads only the explicit CSRF cookie", () => {
    const cookie = [
      "other=value",
      `${BACKOFFICE_CSRF_COOKIE_NAME}=encoded%20token`,
      "babyloop_backoffice_access_token=access"
    ].join("; ");

    expect(readBackofficeCsrfCookie(cookie)).toBe("encoded token");
    expect(readBackofficeCsrfCookie("other=value")).toBeNull();
  });

  it("serializes an expired CSRF cookie", () => {
    const cookie = serializeExpiredBackofficeCsrfCookie();

    expect(cookie).toContain(`${BACKOFFICE_CSRF_COOKIE_NAME}=`);
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=0");
  });

  it("validates matching cookie and header tokens", () => {
    const token = createBackofficeCsrfToken();
    const request = {
      headers: {
        cookie: `${BACKOFFICE_CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`,
        [BACKOFFICE_CSRF_HEADER_NAME]: token
      }
    };

    expect(isBackofficeCsrfRequestValid(request as never)).toBe(true);
    expect(
      isBackofficeCsrfRequestValid({
        headers: {
          cookie: `${BACKOFFICE_CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`,
          [BACKOFFICE_CSRF_HEADER_NAME]: "different-token"
        }
      } as never)
    ).toBe(false);
  });
});

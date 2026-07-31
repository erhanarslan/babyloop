import { describe, expect, it } from "vitest";
import {
  buildLegacyAuthRedirect,
  getAuthModalErrorMessage,
  readAuthModalQuery,
  removeAuthModalQuery
} from "./auth-modal-query";

describe("auth modal query contract", () => {
  it("accepts only supported modal modes and error codes", () => {
    expect(readAuthModalQuery(new URLSearchParams(
      "auth=login&authError=google_auth_failed&returnTo=%2Faccount"
    ))).toEqual({
      errorCode: "google_auth_failed",
      mode: "login",
      passwordChanged: false,
      provider: null,
      returnTo: "/account"
    });

    expect(readAuthModalQuery(new URLSearchParams(
      "auth=register&authError=legal_terms_required&provider=google"
    ))).toEqual({
      errorCode: "legal_terms_required",
      mode: "register",
      passwordChanged: false,
      provider: "google",
      returnTo: null
    });

    expect(readAuthModalQuery(new URLSearchParams("auth=other&authError=google_auth_failed")))
      .toBeNull();
  });

  it("never maps unknown or malformed error values to user-visible text", () => {
    const query = readAuthModalQuery(new URLSearchParams(
      "auth=login&authError=%3Cscript%3Eprovider-secret%3C%2Fscript%3E"
    ));

    expect(query?.errorCode).toBeNull();
    expect(getAuthModalErrorMessage(query?.errorCode ?? null)).toBeNull();
    expect(readAuthModalQuery(new URLSearchParams(
      "auth=register&authError=legal_terms_required&provider=unknown"
    ))?.errorCode).toBeNull();
  });

  it("normalizes legacy routes without carrying unknown or unsafe query values", () => {
    expect(buildLegacyAuthRedirect("login", undefined)).toBe("/?auth=login");
    expect(buildLegacyAuthRedirect("register", undefined)).toBe("/?auth=register");
    expect(buildLegacyAuthRedirect("login", {
      error: "google_auth_failed",
      returnTo: "/account/orders"
    })).toBe(
      "/?auth=login&authError=google_auth_failed&returnTo=%2Faccount%2Forders"
    );
    expect(buildLegacyAuthRedirect("register", {
      error: "legal_terms_required"
    })).toBe(
      "/?auth=register&authError=legal_terms_required&provider=google"
    );
    expect(buildLegacyAuthRedirect("login", {
      error: "raw-provider-error",
      returnTo: "//attacker.example"
    })).toBe("/?auth=login");
  });

  it("removes only auth-owned query keys", () => {
    const result = removeAuthModalQuery(new URLSearchParams(
      "auth=login&authError=google_auth_failed&provider=google&returnTo=%2Faccount&utm_source=safe&page=2"
    ));

    expect(result.toString()).toBe("utm_source=safe&page=2");
  });
});

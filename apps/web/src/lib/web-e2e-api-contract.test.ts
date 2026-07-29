import { describe, expect, it } from "vitest";
import { CURRENT_TERMS_VERSION } from "@babyloop/shared";
import {
  assertEmailVerificationConfirmed,
  buildVerifiedUserRegistrationPayload,
  requireDevEmailVerificationToken
} from "../../e2e/helpers/web-e2e-api";

describe("Web E2E verified-user contract", () => {
  it("fails full-flow setup when the development verification token is absent", () => {
    expect(() => requireDevEmailVerificationToken({}, true)).toThrow(
      "Full-flow Web E2E requires devEmailVerificationToken",
    );
  });

  it("returns the development verification token when present", () => {
    expect(requireDevEmailVerificationToken({ devEmailVerificationToken: "fixture-token" }, true))
      .toBe("fixture-token");
  });

  it("builds the exact strict registration payload with the current terms contract", () => {
    const input = {
      displayName: "E2E Parent",
      email: "e2e-parent@babyloop.test",
      locationCity: "İstanbul",
      password: "Password12345!"
    };

    expect(buildVerifiedUserRegistrationPayload(input)).toEqual({
      ...input,
      termsAccepted: true,
      termsVersion: CURRENT_TERMS_VERSION
    });
    expect(input).not.toHaveProperty("termsAccepted");
    expect(input).not.toHaveProperty("termsVersion");
  });

  it("fails setup unless confirmation explicitly reports emailVerified=true", () => {
    expect(() => assertEmailVerificationConfirmed({ emailVerified: false })).toThrow(
      "emailVerified=true"
    );
    expect(() => assertEmailVerificationConfirmed({})).toThrow("emailVerified=true");
    expect(() => assertEmailVerificationConfirmed({ emailVerified: true })).not.toThrow();
  });
});

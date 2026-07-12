import { buildMobilePostLoginRedirectPath } from "./mobile-login-redirect-model";
import {
  buildMobileListingIntentRedirectPath,
  claimPendingMobileLoginIntent,
  clearPendingMobileLoginIntent,
  peekPendingMobileLoginIntent,
  setPendingMobileLoginIntent
} from "./mobile-login-intent";

describe("mobile login redirect model", () => {
  beforeEach(() => {
    clearPendingMobileLoginIntent();
  });

  afterEach(() => {
    clearPendingMobileLoginIntent();
  });

  it("returns account for normal login", () => {
    expect(buildMobilePostLoginRedirectPath({})).toBe("/account");
  });

  it("keeps listing context and post-login action after authentication", () => {
    expect(buildMobilePostLoginRedirectPath({
      redirectTo: "/listing/listing-1",
      postLoginAction: "message"
    })).toBe("/listing/listing-1?postLoginAction=message");

    expect(buildMobilePostLoginRedirectPath({
      redirectTo: "/listing/listing-1?from=favorites",
      postLoginAction: "favorite"
    })).toBe("/listing/listing-1?from=favorites&postLoginAction=favorite");
  });

  it("rejects unsafe external redirects", () => {
    expect(buildMobilePostLoginRedirectPath({
      redirectTo: "https://evil.example.test",
      postLoginAction: "message"
    })).toBe("/account");

    expect(buildMobilePostLoginRedirectPath({
      redirectTo: "//evil.example.test",
      postLoginAction: "favorite"
    })).toBe("/account");
  });

  it("keeps and claims runtime pending login intent for listing actions", async () => {
    await setPendingMobileLoginIntent({
      action: "message",
      listingId: "listing-1"
    });

    expect(peekPendingMobileLoginIntent()).toEqual({
      action: "message",
      listingId: "listing-1"
    });
    expect(buildMobileListingIntentRedirectPath(peekPendingMobileLoginIntent()!)).toBe(
      "/listing/listing-1?postLoginAction=message"
    );

    await expect(claimPendingMobileLoginIntent()).resolves.toEqual({
      action: "message",
      listingId: "listing-1"
    });

    expect(peekPendingMobileLoginIntent()).toBeNull();
  });
});

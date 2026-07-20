import {
  getMobilePendingPublicationPollDelay,
  shouldPollMobilePendingPublication
} from "./my-listings-runtime-model";

describe("mobile my listings runtime model", () => {
  it("uses bounded progressive polling delays", () => {
    expect([0, 1, 2, 3, 12].map(getMobilePendingPublicationPollDelay)).toEqual([
      7_000,
      12_000,
      20_000,
      30_000,
      30_000
    ]);
  });

  it("polls only while the authenticated screen is focused and active", () => {
    const ready = {
      appState: "active",
      hasCurrentUser: true,
      hasPendingPublication: true,
      isFocused: true,
      status: "ready"
    };

    expect(shouldPollMobilePendingPublication(ready)).toBe(true);
    expect(shouldPollMobilePendingPublication({ ...ready, appState: "background" })).toBe(false);
    expect(shouldPollMobilePendingPublication({ ...ready, isFocused: false })).toBe(false);
    expect(shouldPollMobilePendingPublication({ ...ready, hasPendingPublication: false })).toBe(false);
    expect(shouldPollMobilePendingPublication({ ...ready, hasCurrentUser: false })).toBe(false);
  });
});

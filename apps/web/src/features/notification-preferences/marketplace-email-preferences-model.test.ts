import { describe, expect, it } from "vitest";
import type { NotificationPreference } from "./api";
import {
  findMarketplaceEmailPreference,
  marketplaceEmailPreferenceDefinitions,
  replaceNotificationPreference
} from "./marketplace-email-preferences-model";

function preference(source: string, enabled: boolean): NotificationPreference {
  return {
    id: `${source}-email`,
    source,
    channel: "email",
    enabled,
    mutedUntil: null,
    quietHoursStart: null,
    quietHoursEnd: null,
    timezone: "Europe/Istanbul",
    digest: "immediate",
    deliveryAllowed: enabled,
    providerCallAllowed: true,
    draftOnly: false,
    createdAt: null,
    updatedAt: null
  };
}

describe("marketplace email preferences model", () => {
  it("defines distinct message and listing email controls", () => {
    expect(marketplaceEmailPreferenceDefinitions.map((item) => item.source)).toEqual([
      "messages",
      "listing"
    ]);
  });

  it("finds and immutably replaces the selected preference", () => {
    const preferences = [preference("messages", false), preference("listing", false)];
    const updated = replaceNotificationPreference(preferences, preference("messages", true));

    expect(findMarketplaceEmailPreference(updated, "messages")?.enabled).toBe(true);
    expect(findMarketplaceEmailPreference(preferences, "messages")?.enabled).toBe(false);
    expect(findMarketplaceEmailPreference(updated, "listing")?.enabled).toBe(false);
  });
});

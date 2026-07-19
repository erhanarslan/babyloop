import { describe, expect, it } from "vitest";
import {
  getHomeAutoLoadRequestLimit,
  getHomeInitialListingLimit,
  HOME_AUTO_STOP_LISTING_COUNT,
  HOME_LISTING_SENTINEL_ROOT_MARGIN
} from "./home-feed-policy";

describe("home feed policy", () => {
  it("loads one visible row for desktop, tablet, and mobile", () => {
    expect(getHomeInitialListingLimit(1440)).toBe(4);
    expect(getHomeInitialListingLimit(1024)).toBe(2);
    expect(getHomeInitialListingLimit(390)).toBe(2);
  });

  it("stops automatic loading at exactly 50 listings", () => {
    expect(HOME_AUTO_STOP_LISTING_COUNT).toBe(50);
    expect(getHomeAutoLoadRequestLimit(34)).toBe(16);
    expect(getHomeAutoLoadRequestLimit(48)).toBe(2);
    expect(getHomeAutoLoadRequestLimit(50)).toBe(0);
  });

  it("does not prefetch several screens before the sentinel is near", () => {
    expect(HOME_LISTING_SENTINEL_ROOT_MARGIN).toBe("180px 0px");
  });
});

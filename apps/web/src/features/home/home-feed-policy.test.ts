import { describe, expect, it } from "vitest";
import {
  getHomeAutoLoadRequestLimit,
  getHomeInitialListingLimit,
  HOME_INITIAL_LISTING_LIMIT,
  HOME_LISTING_BATCH_SIZE
} from "./home-feed-policy";

describe("home feed policy", () => {
  it("uses 20 listing pages on every viewport", () => {
    expect(HOME_INITIAL_LISTING_LIMIT).toBe(20);
    expect(HOME_LISTING_BATCH_SIZE).toBe(20);
    expect(getHomeInitialListingLimit(390)).toBe(20);
    expect(getHomeInitialListingLimit(1440)).toBe(20);
  });

  it("keeps loading in 20 item batches without an artificial auto stop", () => {
    expect(getHomeAutoLoadRequestLimit(0)).toBe(20);
    expect(getHomeAutoLoadRequestLimit(200)).toBe(20);
  });
});

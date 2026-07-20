import { getDiscoverHeroListings } from "./discover-performance-model";

const listing = {
  id: "listing-1",
  title: "Bebek arabası"
} as Parameters<typeof getDiscoverHeroListings>[0]["listings"][number];

describe("discover performance model", () => {
  it("reuses the unfiltered result batch for the hero instead of requiring a second listing request", () => {
    const listings = Array.from({ length: 20 }, (_, index) => ({
      ...listing,
      id: `listing-${index}`
    }));

    expect(getDiscoverHeroListings({ activeFilterCount: 0, listings, query: "" })).toHaveLength(10);
    expect(getDiscoverHeroListings({ activeFilterCount: 1, listings, query: "" })).toEqual([]);
    expect(getDiscoverHeroListings({ activeFilterCount: 0, listings, query: "puset" })).toEqual([]);
  });
});

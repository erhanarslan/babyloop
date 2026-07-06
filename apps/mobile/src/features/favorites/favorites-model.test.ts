import { createInitialFavoritesState, favoriteRemoved, favoritesFailed, favoritesLoaded } from "./favorites-model";

describe("favorites model", () => {
  it("handles loading results, empty state, removal, and errors", () => {
    expect(createInitialFavoritesState()).toEqual({
      status: "idle",
      listings: [],
      error: null
    });

    const ready = favoritesLoaded([
      {
        id: "listing-1",
        title: "Bebek arabası",
        seller: {
          profileId: "profile-1",
          displayName: "Ayşe"
        }
      }
    ]);

    expect(ready.status).toBe("ready");
    expect(favoriteRemoved(ready, "listing-1")).toEqual({
      status: "empty",
      listings: [],
      error: null
    });

    expect(favoritesFailed(ready, "Network error")).toEqual({
      status: "error",
      listings: ready.listings,
      error: "Network error"
    });
  });
});

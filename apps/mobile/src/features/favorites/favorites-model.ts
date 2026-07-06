export type MobileFavoriteListing = {
  id: string;
  title: string;
  city?: string | null;
  priceAmount?: string | null;
  currency?: string | null;
  seller?: {
    profileId: string;
    displayName: string;
    locationCity?: string | null;
  } | null;
};

export type MobileFavoritesState =
  | { status: "idle"; listings: MobileFavoriteListing[]; error: null }
  | { status: "loading"; listings: MobileFavoriteListing[]; error: null }
  | { status: "ready"; listings: MobileFavoriteListing[]; error: null }
  | { status: "empty"; listings: []; error: null }
  | { status: "error"; listings: MobileFavoriteListing[]; error: string };

export function createInitialFavoritesState(): MobileFavoritesState {
  return {
    status: "idle",
    listings: [],
    error: null
  };
}

export function favoritesLoaded(listings: MobileFavoriteListing[]): MobileFavoritesState {
  if (listings.length === 0) {
    return {
      status: "empty",
      listings: [],
      error: null
    };
  }

  return {
    status: "ready",
    listings,
    error: null
  };
}

export function favoriteRemoved(state: MobileFavoritesState, listingId: string): MobileFavoritesState {
  const next = state.listings.filter((listing) => listing.id !== listingId);
  return favoritesLoaded(next);
}

export function favoritesFailed(state: MobileFavoritesState, error: string): MobileFavoritesState {
  return {
    status: "error",
    listings: state.listings,
    error
  };
}

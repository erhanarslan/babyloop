import { marketplaceJson } from "../marketplace/api-client";

export type SellerDashboardListing = {
  id: string;
  title: string;
  status: "active" | "reserved" | "sold" | "archived";
  priceAmount?: string | null;
  currency?: string | null;
  city?: string | null;
  imageUrl?: string | null;
  createdAt?: string;
};

export type SellerDashboard = {
  counts: Record<"active" | "reserved" | "sold" | "archived", number>;
  listings: SellerDashboardListing[];
  recentListings?: SellerDashboardListing[];
};

type SellerDashboardResponse = {
  dashboard?: SellerDashboard;
} & Partial<SellerDashboard>;

function normalizeDashboard(data: SellerDashboardResponse): SellerDashboard {
  if (data.dashboard) {
    return data.dashboard;
  }

  const recentListings = data.recentListings;
  return {
    counts: {
      active: data.counts?.active ?? 0,
      reserved: data.counts?.reserved ?? 0,
      sold: data.counts?.sold ?? 0,
      archived: data.counts?.archived ?? 0
    },
    listings: data.listings ?? recentListings ?? [],
    ...(recentListings ? { recentListings } : {})
  };
}

export async function getSellerDashboard(): Promise<SellerDashboard> {
  return normalizeDashboard(await marketplaceJson<SellerDashboardResponse>("/api/v1/seller/dashboard"));
}

export async function updateListingStatus(listingId: string, status: SellerDashboardListing["status"]): Promise<SellerDashboardListing> {
  const data = await marketplaceJson<{ listing?: SellerDashboardListing } | { data?: { listing?: SellerDashboardListing } }>(
    `/api/v1/listings/${encodeURIComponent(listingId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status })
    }
  );

  if ("listing" in data && data.listing) {
    return data.listing;
  }

  if ("data" in data && data.data?.listing) {
    return data.data.listing;
  }

  return {
    id: listingId,
    title: "",
    status
  };
}

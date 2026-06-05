export const listingTypes = [
  { value: "sale" },
  { value: "swap" },
  { value: "donation" }
] as const;

export const conditions = [
  { value: "new" },
  { value: "like_new" },
  { value: "good" },
  { value: "fair" },
  { value: "needs_repair" }
] as const;

export type ListingType = (typeof listingTypes)[number]["value"];
export type ListingCondition = (typeof conditions)[number]["value"];

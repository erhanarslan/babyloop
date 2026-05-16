export const listingTypes = [
  { value: "sale", label: "For sale" },
  { value: "swap", label: "Swap" },
  { value: "donation", label: "Donation" },
  { value: "rent", label: "Rent" }
] as const;

export const conditions = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "needs_repair", label: "Needs repair" }
] as const;

export type ListingType = (typeof listingTypes)[number]["value"];
export type ListingCondition = (typeof conditions)[number]["value"];


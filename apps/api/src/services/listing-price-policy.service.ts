export function resolveListingTypeForPrice(input: {
  listingType: "sale" | "swap" | "donation";
  priceAmount: string | null | undefined;
}): "sale" | "swap" | "donation" {
  return input.priceAmount ? input.listingType : "donation";
}

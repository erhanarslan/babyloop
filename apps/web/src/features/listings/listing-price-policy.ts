import type { CreateListingRequest } from "./api";

export function needsDonationConfirmation(payload: CreateListingRequest): boolean {
  return !payload.priceAmount?.trim();
}

export function toDonationListingPayload(
  payload: CreateListingRequest
): CreateListingRequest {
  const { priceAmount: _priceAmount, ...rest } = payload;

  return {
    ...rest,
    listingType: "donation"
  };
}

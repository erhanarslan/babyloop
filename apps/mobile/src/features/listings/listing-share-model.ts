export type MobileListingShareMessageInput = {
  priceText: string;
  title: string;
  url: string;
};

export function buildMobileListingShareMessage(
  input: MobileListingShareMessageInput
): string {
  return normalizeShareLine(input.url);
}

function normalizeShareLine(value: string): string {
  return value.replace(/[\r\n]+/gu, " ").replace(/\s+/gu, " ").trim();
}

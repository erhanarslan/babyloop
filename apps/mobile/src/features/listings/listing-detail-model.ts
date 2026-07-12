export type MobileListingDetailActionState = {
  canAddToCart: boolean;
  canFavorite: boolean;
  canMessageSeller: boolean;
  notice: string | null;
  statusTone: "neutral" | "success" | "warning";
};

export function getMobileListingDetailActionState(input: {
  isOwnListing: boolean;
  listingType: string | null | undefined;
  status: string | null | undefined;
}): MobileListingDetailActionState {
  if (input.isOwnListing) {
    return {
      canAddToCart: false,
      canFavorite: false,
      canMessageSeller: false,
      notice: "Bu ilan sana ait. Alıcı aksiyonları gizlendi.",
      statusTone: "neutral"
    };
  }

  if (input.status === "sold") {
    return {
      canAddToCart: false,
      canFavorite: false,
      canMessageSeller: false,
      notice: "Bu ürün satılmış. Satıcıya yazma ve favori aksiyonları kapalı.",
      statusTone: "neutral"
    };
  }

  if (input.status === "archived") {
    return {
      canAddToCart: false,
      canFavorite: false,
      canMessageSeller: false,
      notice: "Bu ilan yayında değil.",
      statusTone: "neutral"
    };
  }

  if (input.status === "reserved") {
    return {
      canAddToCart: false,
      canFavorite: true,
      canMessageSeller: true,
      notice: "Bu ürün rezerve. Uygunluk durumunu satıcıya sorabilirsin.",
      statusTone: "warning"
    };
  }

  return {
    canAddToCart: input.listingType !== "donation",
    canFavorite: true,
    canMessageSeller: true,
    notice: null,
    statusTone: "success"
  };
}

export function getMobileListingGalleryImageUrls(input: {
  imageUrl: string | null;
  imageUrls?: string[];
}): string[] {
  const urls: string[] = [];

  for (const url of input.imageUrls ?? []) {
    const normalized = url.trim();

    if (normalized && !urls.includes(normalized)) {
      urls.push(normalized);
    }
  }

  const fallback = input.imageUrl?.trim();

  if (fallback && !urls.includes(fallback)) {
    urls.push(fallback);
  }

  return urls;
}

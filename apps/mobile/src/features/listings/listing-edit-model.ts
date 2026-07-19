import type { MobileEditableListingDetail } from "./listings-api";
import {
  parseMobileListingAgeRange,
  toMobileListingAgeRangeValue
} from "./listing-age-range-model";

export type MobileListingEditFormState = {
  categoryId: string;
  condition: string;
  description: string;
  listingType: string;
  priceAmount: string;
  recommendedAgeRange: string;
  title: string;
};

export type MobileListingEditValidationResult =
  | {
      ok: true;
      payload: {
        categoryId: string;
        condition: string;
        currency: "TRY";
        description: string;
        listingType: string;
        priceAmount: string | null;
        recommendedAgeMinMonths: number | null;
        recommendedAgeMaxMonths: number | null;
        title: string;
      };
    }
  | {
      ok: false;
      message: string;
    };

export function createMobileListingEditFormState(
  listing: MobileEditableListingDetail
): MobileListingEditFormState {
  return {
    categoryId: listing.categoryId ?? "",
    condition: listing.condition ?? "good",
    description: listing.description ?? "",
    listingType: listing.listingType ?? "sale",
    priceAmount: listing.priceAmount ?? "",
    recommendedAgeRange: toMobileListingAgeRangeValue(
      listing.recommendedAgeMinMonths,
      listing.recommendedAgeMaxMonths
    ),
    title: listing.title
  };
}

export function buildMobileListingEditPayload(
  state: MobileListingEditFormState
): MobileListingEditValidationResult {
  const title = state.title.trim();
  const description = state.description.trim();
  const priceAmount = normalizeMobileListingEditPrice(state.priceAmount);
  const recommendedAgeRange = parseMobileListingAgeRange(state.recommendedAgeRange);

  if (!state.categoryId) {
    return {
      ok: false,
      message: "Kategori seçmelisin."
    };
  }

  if (title.length < 4) {
    return {
      ok: false,
      message: "Başlık en az 4 karakter olmalı."
    };
  }

  if (title.length > 160) {
    return {
      ok: false,
      message: "Başlık en fazla 160 karakter olabilir."
    };
  }

  if (description.length > 2000) {
    return {
      ok: false,
      message: "Açıklama en fazla 2000 karakter olabilir."
    };
  }

  if (priceAmount === "invalid") {
    return {
      ok: false,
      message: "Fiyatı 1000 veya 1000.50 formatında yaz."
    };
  }

  if (!recommendedAgeRange) {
    return {
      ok: false,
      message: "Geçerli bir önerilen yaş aralığı seçmelisin."
    };
  }

  return {
    ok: true,
    payload: {
      categoryId: state.categoryId,
      condition: state.condition,
      currency: "TRY",
      description,
      listingType: state.listingType,
      priceAmount,
      recommendedAgeMinMonths: recommendedAgeRange.minMonths,
      recommendedAgeMaxMonths: recommendedAgeRange.maxMonths,
      title
    }
  };
}

export function getMobileListingEditImageLimitMessage(input: {
  currentCount: number;
  maxCount?: number;
}): string | null {
  const maxCount = input.maxCount ?? 5;

  if (input.currentCount >= maxCount) {
    return `En fazla ${maxCount} fotoğraf ekleyebilirsin.`;
  }

  return null;
}

export function moveMobileListingImageId(input: {
  direction: "down" | "up";
  imageId: string;
  imageIds: string[];
}): string[] {
  const currentIndex = input.imageIds.indexOf(input.imageId);

  if (currentIndex === -1) {
    return input.imageIds;
  }

  const nextIndex = input.direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (nextIndex < 0 || nextIndex >= input.imageIds.length) {
    return input.imageIds;
  }

  const nextImageIds = [...input.imageIds];
  const current = nextImageIds[currentIndex];
  const next = nextImageIds[nextIndex];

  nextImageIds[currentIndex] = next;
  nextImageIds[nextIndex] = current;

  return nextImageIds;
}

function normalizeMobileListingEditPrice(value: string): string | null | "invalid" {
  const normalized = value.trim().replace(",", ".");

  if (!normalized) {
    return null;
  }

  if (!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/u.test(normalized)) {
    return "invalid";
  }

  return normalized;
}

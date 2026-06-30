export const mobileListingTypeOptions = [
  {
    value: "sale",
    label: "Satılık"
  },
  {
    value: "donation",
    label: "Bağış"
  },
  {
    value: "swap",
    label: "Takas"
  }
] as const;

export const mobileListingConditionOptions = [
  {
    value: "new",
    label: "Yeni"
  },
  {
    value: "like_new",
    label: "Yeni gibi"
  },
  {
    value: "good",
    label: "İyi"
  },
  {
    value: "fair",
    label: "Kullanılmış"
  },
  {
    value: "needs_repair",
    label: "Tamir gerekir"
  }
] as const;

export type MobileListingType = (typeof mobileListingTypeOptions)[number]["value"];
export type MobileListingCondition = (typeof mobileListingConditionOptions)[number]["value"];

export type MobileSellFormState = {
  categoryId: string;
  condition: MobileListingCondition;
  description: string;
  listingType: MobileListingType;
  priceAmount: string;
  title: string;
};

export type MobileCreateListingPayload = {
  categoryId: string;
  condition: MobileListingCondition;
  currency: "TRY";
  description?: string;
  listingType: MobileListingType;
  priceAmount?: string;
  title: string;
};

export type MobileSellFormValidationResult =
  | {
      ok: true;
      payload: MobileCreateListingPayload;
    }
  | {
      ok: false;
      message: string;
    };

const DECIMAL_PRICE_PATTERN = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;

export function createDefaultMobileSellFormState(): MobileSellFormState {
  return {
    categoryId: "",
    condition: "good",
    description: "",
    listingType: "sale",
    priceAmount: "",
    title: ""
  };
}

export function buildMobileCreateListingPayload(
  state: MobileSellFormState
): MobileSellFormValidationResult {
  const title = normalizeWhitespace(state.title);
  const description = normalizeMultilineText(state.description);
  const priceAmount = normalizePriceAmount(state.priceAmount);

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

  if (description && description.length > 2000) {
    return {
      ok: false,
      message: "Açıklama en fazla 2000 karakter olabilir."
    };
  }

  if (priceAmount && !DECIMAL_PRICE_PATTERN.test(priceAmount)) {
    return {
      ok: false,
      message: "Fiyatı 1000 veya 1000.50 formatında yaz."
    };
  }

  return {
    ok: true,
    payload: {
      categoryId: state.categoryId,
      condition: state.condition,
      currency: "TRY",
      ...(description ? { description } : {}),
      listingType: state.listingType,
      ...(priceAmount ? { priceAmount } : {}),
      title
    }
  };
}

export function normalizePriceAmount(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeMultilineText(value: string): string {
  return value
    .trim()
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

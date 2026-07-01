import {
  formatMobileListingCondition,
  formatMobileListingStatus,
  formatMobileListingType
} from "../listings/listing-labels";

export type MobileCartItem = {
  id: string;
  listingId: string;
  title: string;
  priceText: string;
  imageUrl: string | null;
  status: string | null;
  statusText: string;
  listingType: string | null;
  listingTypeText: string;
  conditionText: string | null;
};

export type MobileCart = {
  items: MobileCartItem[];
  unavailableItems: MobileCartItem[];
  subtotalText: string;
};

export type MobileMockCheckout = {
  orderId: string;
  paymentId: string;
  paidAmountText: string;
  itemCount: number;
};

export function normalizeCart(
  payload: unknown,
  resolveImageUrl: (url: string | null | undefined) => string | null = defaultResolveImageUrl
): MobileCart {
  const cart = extractCartObject(payload);
  const items = extractArray(cart.items).map((item) => normalizeCartItem(item, resolveImageUrl));
  const unavailableItems = extractArray(cart.unavailableItems).map((item) => normalizeCartItem(item, resolveImageUrl));

  return {
    items,
    unavailableItems,
    subtotalText: formatPriceObject(cart.subtotal)
  };
}

export function normalizeCheckout(payload: unknown): MobileMockCheckout {
  const checkout = extractCheckoutObject(payload);
  const orderId = pickString(checkout, ["orderId"]) ?? "mock-order";
  const paymentId = pickString(checkout, ["mockIyzicoPaymentId", "paymentId"]) ?? "mock-payment";

  return {
    orderId,
    paymentId,
    paidAmountText: formatMoney(
      Number(pickString(checkout, ["paidAmount"]) ?? "0"),
      pickString(checkout, ["currency"]) ?? "TRY"
    ),
    itemCount: extractArray(checkout.items).length
  };
}

function normalizeCartItem(
  value: unknown,
  resolveImageUrl: (url: string | null | undefined) => string | null
): MobileCartItem {
  const record = isRecord(value) ? value : {};
  const listing = isRecord(record.listing) ? record.listing : record;
  const listingType = pickString(listing, ["listingType"]);
  const status = pickString(listing, ["status"]);

  return {
    id: pickString(record, ["id"]) ?? pickString(listing, ["id", "listingId"]) ?? "cart-item",
    listingId: pickString(listing, ["id", "listingId"]) ?? "listing",
    title: pickString(listing, ["title", "name"]) ?? "İlan",
    priceText: formatPriceObject(listing.price),
    imageUrl: resolveImageUrl(extractImageUrl(listing)),
    status,
    statusText: formatMobileListingStatus(status),
    listingType,
    listingTypeText: formatMobileListingType(listingType),
    conditionText: formatMobileListingCondition(pickString(listing, ["condition"]))
  };
}

function defaultResolveImageUrl(url: string | null | undefined): string | null {
  return typeof url === "string" && url.length > 0 ? url : null;
}

function extractCartObject(payload: unknown): Record<string, unknown> {
  if (isRecord(payload) && isRecord(payload.cart)) {
    return payload.cart;
  }

  if (isRecord(payload) && isRecord(payload.data)) {
    return extractCartObject(payload.data);
  }

  return {};
}

function extractCheckoutObject(payload: unknown): Record<string, unknown> {
  if (isRecord(payload) && isRecord(payload.checkout)) {
    return payload.checkout;
  }

  if (isRecord(payload) && isRecord(payload.data)) {
    return extractCheckoutObject(payload.data);
  }

  return {};
}

function extractArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function formatPriceObject(value: unknown): string {
  if (!isRecord(value)) {
    return "0 TL";
  }

  return formatMoney(Number(pickString(value, ["amount"]) ?? "0"), pickString(value, ["currency"]) ?? "TRY");
}

function formatMoney(amount: number, currency: string): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const hasDecimals = Math.round(safeAmount * 100) % 100 !== 0;
  const formatted = safeAmount.toLocaleString("tr-TR", {
    maximumFractionDigits: hasDecimals ? 2 : 0,
    minimumFractionDigits: hasDecimals ? 2 : 0
  });

  return `${formatted} ${currency === "TRY" ? "TL" : currency}`;
}

function extractImageUrl(record: Record<string, unknown>): string | null {
  const firstImage = record.firstImage;

  if (isRecord(firstImage)) {
    return pickString(firstImage, ["url", "imageUrl"]);
  }

  const images = record.images;

  if (Array.isArray(images)) {
    for (const image of images) {
      if (isRecord(image)) {
        const url = pickString(image, ["url", "imageUrl"]);

        if (url) {
          return url;
        }
      }
    }
  }

  return null;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import type { Dictionary, Locale } from "../../lib/i18n/dictionaries";

type ListingPrice = {
  amount: string;
  currency: string;
} | null;

type CategoryLike = {
  name: string;
  slug: string;
};

export function formatCategoryName(category: CategoryLike, dictionary: Dictionary): string {
  const categoryNames = dictionary.listings.categoryNames as Record<string, string>;

  return categoryNames[category.slug] ?? category.name;
}

export function formatListingType(value: string, dictionary: Dictionary): string {
  const listingTypes = dictionary.listings.listingTypes as Record<string, string>;

  return listingTypes[value] ?? humanizeLabel(value);
}

export function formatListingCondition(value: string, dictionary: Dictionary): string {
  const conditions = dictionary.listings.conditions as Record<string, string>;

  return conditions[value] ?? humanizeLabel(value);
}

export function formatListingStatus(value: string, dictionary: Dictionary): string {
  const statuses = dictionary.listings.statuses as Record<string, string>;

  return statuses[value] ?? humanizeLabel(value);
}

export function formatListingPrice(price: ListingPrice, dictionary: Dictionary): string {
  if (!price) {
    return "Bağış";
  }

  const amount = Number(price.amount);

  if (!Number.isFinite(amount)) {
    return `${price.amount} ${price.currency}`.trim();
  }

  try {
    return new Intl.NumberFormat("tr-TR", {
      currency: price.currency || "TRY",
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      style: "currency"
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat("tr-TR", {
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2
    }).format(amount)} ${price.currency}`.trim();
  }
}

export function formatDateTime(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US").format(new Date(value));
}

function humanizeLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

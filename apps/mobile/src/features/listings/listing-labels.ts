export function formatMobileListingType(value: string | null | undefined): string {
  switch (value) {
    case "sale":
      return "Satılık";
    case "donation":
      return "Bağış";
    case "swap":
      return "Takas";
    default:
      return "İlan tipi belirtilmedi";
  }
}

export function formatMobileListingCondition(value: string | null | undefined): string | null {
  switch (value) {
    case "new":
      return "Yeni";
    case "like_new":
      return "Yeni gibi";
    case "good":
      return "İyi";
    case "fair":
      return "Kullanılmış";
    case "needs_repair":
      return "Tamir gerekir";
    default:
      return null;
  }
}

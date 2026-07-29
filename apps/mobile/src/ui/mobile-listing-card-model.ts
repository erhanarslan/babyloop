export type MobileListingCardChip = {
  label: string;
  tone?: "neutral" | "primary" | "success" | "warning";
};

export function buildMobileListingChips(input: {
  isDemo?: boolean;
  statusText?: string | null;
  listingTypeText?: string | null;
  conditionText?: string | null;
}): MobileListingCardChip[] {
  const statusText = normalizeOptionalLabel(input.statusText, "Durum bilinmiyor");
  const listingTypeText = normalizeOptionalLabel(input.listingTypeText, "İlan tipi belirtilmedi");
  const conditionText = normalizeOptionalLabel(input.conditionText, "Durum belirtilmedi");

  const chips: Array<MobileListingCardChip | null> = [
    input.isDemo ? { label: "Demo ilan", tone: "warning" } : null,
    statusText ? { label: statusText, tone: getStatusChipTone(statusText) } : null,
    listingTypeText ? { label: listingTypeText, tone: "primary" } : null,
    conditionText ? { label: conditionText } : null
  ];

  return chips.filter(isChip);
}

function normalizeOptionalLabel(value: string | null | undefined, fallbackLabel: string): string | null {
  if (!value || value === fallbackLabel) {
    return null;
  }

  return value;
}

function getStatusChipTone(statusText: string): MobileListingCardChip["tone"] {
  if (statusText === "Aktif") {
    return "success";
  }

  if (statusText === "Rezerve") {
    return "warning";
  }

  return "neutral";
}

function isChip(value: MobileListingCardChip | null): value is MobileListingCardChip {
  return value !== null;
}

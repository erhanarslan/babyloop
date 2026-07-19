export type MobileListingAgeRange = {
  minMonths: number | null;
  maxMonths: number | null;
};

export const mobileListingAgeRangeOptions = [
  { value: "independent", label: "Yaştan bağımsız", minMonths: null, maxMonths: null },
  { value: "0:3", label: "0–3 ay", minMonths: 0, maxMonths: 3 },
  { value: "3:6", label: "3–6 ay", minMonths: 3, maxMonths: 6 },
  { value: "6:12", label: "6–12 ay", minMonths: 6, maxMonths: 12 },
  { value: "12:24", label: "12–24 ay", minMonths: 12, maxMonths: 24 },
  { value: "24:36", label: "24–36 ay", minMonths: 24, maxMonths: 36 },
  { value: "36:72", label: "3–6 yaş", minMonths: 36, maxMonths: 72 },
  { value: "72:216", label: "6 yaş ve üzeri", minMonths: 72, maxMonths: 216 }
] as const;

export function parseMobileListingAgeRange(value: string): MobileListingAgeRange | null {
  const preset = mobileListingAgeRangeOptions.find((option) => option.value === value);

  if (preset) {
    return {
      minMonths: preset.minMonths,
      maxMonths: preset.maxMonths
    };
  }

  const customMatch = /^custom:([0-9]{1,3}):([0-9]{1,3})$/u.exec(value);

  if (!customMatch) {
    return null;
  }

  const minMonths = Number(customMatch[1]);
  const maxMonths = Number(customMatch[2]);

  if (
    !Number.isInteger(minMonths) ||
    !Number.isInteger(maxMonths) ||
    minMonths < 0 ||
    maxMonths > 216 ||
    minMonths > maxMonths
  ) {
    return null;
  }

  return { minMonths, maxMonths };
}

export function toMobileListingAgeRangeValue(
  minMonths: number | null,
  maxMonths: number | null
): string {
  const preset = mobileListingAgeRangeOptions.find(
    (option) => option.minMonths === minMonths && option.maxMonths === maxMonths
  );

  if (preset) {
    return preset.value;
  }

  if (
    minMonths !== null &&
    maxMonths !== null &&
    minMonths >= 0 &&
    maxMonths <= 216 &&
    minMonths <= maxMonths
  ) {
    return `custom:${minMonths}:${maxMonths}`;
  }

  return "independent";
}

export function formatMobileListingAgeRange(
  minMonths: number | null,
  maxMonths: number | null
): string {
  const value = toMobileListingAgeRangeValue(minMonths, maxMonths);
  const preset = mobileListingAgeRangeOptions.find((option) => option.value === value);

  if (preset) {
    return preset.label;
  }

  if (minMonths === null || maxMonths === null) {
    return "Yaştan bağımsız";
  }

  if (minMonths >= 36 && minMonths % 12 === 0 && maxMonths % 12 === 0) {
    return `${minMonths / 12}–${maxMonths / 12} yaş`;
  }

  return `${minMonths}–${maxMonths} ay`;
}

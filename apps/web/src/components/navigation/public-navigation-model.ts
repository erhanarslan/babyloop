import type { Dictionary } from "../../lib/i18n/dictionaries";

export type CategoryLinkKey = keyof Dictionary["publicShell"]["categoryLinks"];
export type QuickCategoryLinkKey = keyof Dictionary["publicShell"]["quickCategoryLinks"];
export type AccountMenuKey = keyof Dictionary["publicShell"]["accountMenu"];
export type LocationOptionKey = keyof Dictionary["publicShell"]["locationOptions"];

export type CategoryNavigationLink = {
  description?: string;
  href: string;
  labelKey: CategoryLinkKey;
};

export type QuickNavigationLink = {
  href: string;
  labelKey: QuickCategoryLinkKey;
};

export type AccountNavigationLink = {
  href: string;
  labelKey: AccountMenuKey;
};

export type CategoryGroup = {
  icon: string;
  id: keyof Dictionary["publicShell"]["categoryGroups"];
  links: CategoryNavigationLink[];
  query: string;
};

export type LocationOption = {
  labelKey: LocationOptionKey;
  value: string;
};

export const locationOptions: LocationOption[] = [
  { labelKey: "turkiye", value: "turkiye" },
  { labelKey: "istanbul", value: "istanbul" },
  { labelKey: "ankara", value: "ankara" },
  { labelKey: "izmir", value: "izmir" },
  { labelKey: "bursa", value: "bursa" },
  { labelKey: "antalya", value: "antalya" },
  { labelKey: "konya", value: "konya" },
  { labelKey: "kocaeli", value: "kocaeli" },
  { labelKey: "sakarya", value: "sakarya" },
  { labelKey: "eskisehir", value: "eskisehir" },
  { labelKey: "adana", value: "adana" }
];

export const popularSearches = [
  "stroller",
  "carSeat",
  "highChair",
  "playpen",
  "montessoriToy",
  "twoYearCoat",
  "freeBabyClothes"
] satisfies CategoryLinkKey[];

export const babyCategoryGroups: CategoryGroup[] = [
  {
    icon: "↗",
    id: "travel",
    query: "bebek arabası",
    links: [
      { href: "/browse?q=bebek%20arabası", labelKey: "stroller" },
      { href: "/browse?q=puset", labelKey: "pushchair" },
      { href: "/browse?q=portbebe", labelKey: "carrycot" },
      { href: "/browse?q=kanguru", labelKey: "babyCarrier" },
      { href: "/browse?q=seyahat%20sistemi", labelKey: "travelSystem" }
    ]
  },
  {
    icon: "✓",
    id: "safety",
    query: "oto koltuğu",
    links: [
      { href: "/categories/car-seats", labelKey: "carSeat" },
      { href: "/browse?q=ana%20kucağı", labelKey: "infantSeat" },
      { href: "/browse?q=güvenlik%20kapısı", labelKey: "safetyGate" },
      { href: "/browse?q=bebek%20telsizi", labelKey: "babyMonitor" }
    ]
  },
  {
    icon: "☾",
    id: "sleep",
    query: "park yatak",
    links: [
      { href: "/browse?q=beşik", labelKey: "crib" },
      { href: "/browse?q=park%20yatak", labelKey: "playpen" },
      { href: "/browse?q=uyku%20tulumu", labelKey: "sleepSack" },
      { href: "/browse?q=bebek%20odası", labelKey: "nursery" }
    ]
  },
  {
    icon: "◐",
    id: "feeding",
    query: "mama sandalyesi",
    links: [
      { href: "/browse?q=mama%20sandalyesi", labelKey: "highChair" },
      { href: "/browse?q=biberon", labelKey: "bottle" },
      { href: "/browse?q=sterilizatör", labelKey: "sterilizer" },
      { href: "/browse?q=süt%20pompası", labelKey: "breastPump" }
    ]
  },
  {
    icon: "◇",
    id: "clothing",
    query: "bebek giyim",
    links: [
      { href: "/browse?q=0-3%20ay", labelKey: "zeroToThreeMonths" },
      { href: "/browse?q=1%20yaş%20kıyafet", labelKey: "oneYearClothes" },
      { href: "/browse?q=2%20yaş%20mont", labelKey: "twoYearCoat" },
      { href: "/browse?q=bebek%20ayakkabı", labelKey: "babyShoes" }
    ]
  },
  {
    icon: "✦",
    id: "play",
    query: "montessori oyuncak",
    links: [
      { href: "/categories/montessori-toys", labelKey: "montessoriToy" },
      { href: "/browse?q=eğitici%20oyuncak", labelKey: "educationalToy" },
      { href: "/browse?q=çocuk%20kitabı", labelKey: "childrenBook" },
      { href: "/browse?q=puzzle", labelKey: "puzzle" }
    ]
  },
  {
    icon: "＋",
    id: "care",
    query: "bebek küveti",
    links: [
      { href: "/browse?q=bebek%20küveti", labelKey: "babyBath" },
      { href: "/browse?q=bez%20değiştirme", labelKey: "diaperChanging" },
      { href: "/browse?q=bakım%20çantası", labelKey: "careBag" }
    ]
  },
  {
    icon: "♡",
    id: "parent",
    query: "emzirme",
    links: [
      { href: "/browse?q=hamile%20giyim", labelKey: "maternityWear" },
      { href: "/browse?q=emzirme", labelKey: "nursingProducts" },
      { href: "/guides", labelKey: "parentGuides" }
    ]
  },
  {
    icon: "7",
    id: "kids",
    query: "3 yaş oyuncak",
    links: [
      { href: "/browse?q=3%20yaş%20oyuncak", labelKey: "threeToSevenToy" },
      { href: "/browse?q=çocuk%20bisikleti", labelKey: "bike" },
      { href: "/browse?q=scooter", labelKey: "scooter" },
      { href: "/browse?q=okul%20öncesi", labelKey: "preschool" }
    ]
  },
  {
    icon: "∞",
    id: "reuse",
    query: "ücretsiz bebek kıyafeti",
    links: [
      { href: "/browse?q=ücretsiz%20bebek%20kıyafeti", labelKey: "freeBabyClothes" },
      { href: "/browse?q=bağış", labelKey: "donation" },
      { href: "/browse?q=takas", labelKey: "swap" }
    ]
  }
];

export const quickCategoryLinks: QuickNavigationLink[] = [
  { href: "/guides", labelKey: "parentGuide" },
  { href: "/account/children", labelKey: "childNeeds" },
  { href: "/assistant", labelKey: "assistant" },
];

export const accountLinks: AccountNavigationLink[] = [
  { href: "/account/profile", labelKey: "profile" },
  { href: "/my-listings", labelKey: "myListings" },
  { href: "/account/seller", labelKey: "sellerDashboard" },
  { href: "/conversations", labelKey: "messages" },
  { href: "/notifications", labelKey: "notifications" },
  { href: "/account/saved-searches", labelKey: "savedSearches" },
  { href: "/account/children", labelKey: "childProfiles" },
  { href: "/favorites", labelKey: "favorites" }
];

export function getLocationLabel(value: string, dictionary?: Dictionary): string {
  const option = locationOptions.find((locationOption) => locationOption.value === value) ?? locationOptions[1]!;

  if (dictionary) {
    return dictionary.publicShell.locationOptions[option.labelKey];
  }

  return fallbackLocationLabels[option.labelKey];
}

export function getLocationQueryValue(value: string): string {
  if (value === "turkiye") {
    return "";
  }

  const option = locationOptions.find((locationOption) => locationOption.value === value);

  return option ? fallbackLocationLabels[option.labelKey] : "";
}

const fallbackLocationLabels: Record<LocationOptionKey, string> = {
  turkiye: "Tüm Türkiye",
  istanbul: "İstanbul",
  ankara: "Ankara",
  izmir: "İzmir",
  bursa: "Bursa",
  antalya: "Antalya",
  konya: "Konya",
  kocaeli: "Kocaeli",
  sakarya: "Sakarya",
  eskisehir: "Eskişehir",
  adana: "Adana"
};

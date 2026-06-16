import type { Dictionary } from "../../lib/i18n/dictionaries";

export type NavigationLink = {
  description?: string;
  href: string;
  label: string;
};

export type CategoryGroup = {
  icon: string;
  id: keyof Dictionary["publicShell"]["categoryGroups"];
  links: NavigationLink[];
  query: string;
};

export type LocationOption = {
  label: string;
  value: string;
};

export const locationOptions: LocationOption[] = [
  { label: "Tüm Türkiye", value: "turkiye" },
  { label: "İstanbul", value: "istanbul" },
  { label: "Ankara", value: "ankara" },
  { label: "İzmir", value: "izmir" },
  { label: "Bursa", value: "bursa" },
  { label: "Antalya", value: "antalya" },
  { label: "Konya", value: "konya" },
  { label: "Kocaeli", value: "kocaeli" },
  { label: "Sakarya", value: "sakarya" },
  { label: "Eskişehir", value: "eskisehir" },
  { label: "Adana", value: "adana" }
];

export const popularSearches = [
  "Bebek arabası",
  "Oto koltuğu",
  "Mama sandalyesi",
  "Park yatak",
  "Montessori oyuncak",
  "2 yaş mont",
  "Ücretsiz bebek kıyafeti"
] as const;

export const babyCategoryGroups: CategoryGroup[] = [
  {
    icon: "↗",
    id: "travel",
    query: "bebek arabası",
    links: [
      { href: "/browse?q=bebek%20arabası", label: "Bebek arabası" },
      { href: "/browse?q=puset", label: "Puset" },
      { href: "/browse?q=portbebe", label: "Portbebe" },
      { href: "/browse?q=kanguru", label: "Kanguru" },
      { href: "/browse?q=seyahat%20sistemi", label: "Seyahat sistemi" }
    ]
  },
  {
    icon: "✓",
    id: "safety",
    query: "oto koltuğu",
    links: [
      { href: "/categories/car-seats", label: "Oto koltuğu" },
      { href: "/browse?q=ana%20kucağı", label: "Ana kucağı" },
      { href: "/browse?q=güvenlik%20kapısı", label: "Güvenlik kapısı" },
      { href: "/browse?q=bebek%20telsizi", label: "Bebek telsizi" }
    ]
  },
  {
    icon: "☾",
    id: "sleep",
    query: "park yatak",
    links: [
      { href: "/browse?q=beşik", label: "Beşik" },
      { href: "/browse?q=park%20yatak", label: "Park yatak" },
      { href: "/browse?q=uyku%20tulumu", label: "Uyku tulumu" },
      { href: "/browse?q=bebek%20odası", label: "Bebek odası" }
    ]
  },
  {
    icon: "◐",
    id: "feeding",
    query: "mama sandalyesi",
    links: [
      { href: "/browse?q=mama%20sandalyesi", label: "Mama sandalyesi" },
      { href: "/browse?q=biberon", label: "Biberon" },
      { href: "/browse?q=sterilizatör", label: "Sterilizatör" },
      { href: "/browse?q=süt%20pompası", label: "Süt pompası" }
    ]
  },
  {
    icon: "◇",
    id: "clothing",
    query: "bebek giyim",
    links: [
      { href: "/browse?q=0-3%20ay", label: "0-3 ay" },
      { href: "/browse?q=1%20yaş%20kıyafet", label: "1 yaş" },
      { href: "/browse?q=2%20yaş%20mont", label: "2 yaş mont" },
      { href: "/browse?q=bebek%20ayakkabı", label: "Ayakkabı" }
    ]
  },
  {
    icon: "✦",
    id: "play",
    query: "montessori oyuncak",
    links: [
      { href: "/categories/montessori-toys", label: "Montessori oyuncak" },
      { href: "/browse?q=eğitici%20oyuncak", label: "Eğitici oyuncak" },
      { href: "/browse?q=çocuk%20kitabı", label: "Kitap" },
      { href: "/browse?q=puzzle", label: "Puzzle" }
    ]
  },
  {
    icon: "＋",
    id: "care",
    query: "bebek küveti",
    links: [
      { href: "/browse?q=bebek%20küveti", label: "Bebek küveti" },
      { href: "/browse?q=bez%20değiştirme", label: "Bez değiştirme" },
      { href: "/browse?q=bakım%20çantası", label: "Bakım çantası" }
    ]
  },
  {
    icon: "♡",
    id: "parent",
    query: "emzirme",
    links: [
      { href: "/browse?q=hamile%20giyim", label: "Hamile giyim" },
      { href: "/browse?q=emzirme", label: "Emzirme ürünleri" },
      { href: "/guides", label: "Ebeveyn rehberleri" }
    ]
  },
  {
    icon: "7",
    id: "kids",
    query: "3 yaş oyuncak",
    links: [
      { href: "/browse?q=3%20yaş%20oyuncak", label: "3-7 yaş oyuncak" },
      { href: "/browse?q=çocuk%20bisikleti", label: "Bisiklet" },
      { href: "/browse?q=scooter", label: "Scooter" },
      { href: "/browse?q=okul%20öncesi", label: "Okul öncesi" }
    ]
  },
  {
    icon: "∞",
    id: "reuse",
    query: "ücretsiz bebek kıyafeti",
    links: [
      { href: "/browse?q=ücretsiz%20bebek%20kıyafeti", label: "Ücretsiz bebek kıyafeti" },
      { href: "/browse?q=bağış", label: "Bağış" },
      { href: "/browse?q=takas", label: "Takas" }
    ]
  }
];

export const quickCategoryLinks: NavigationLink[] = [
  { href: "/guides", label: "Ebeveyn rehberi" },
  { href: "/account/children", label: "Çocuğum" },
  { href: "/assistant", label: "Asistan" },
  { href: "/guides?topic=parent-reviews", label: "Ebeveyn yorumları" }
];

export const accountLinks: NavigationLink[] = [
  { href: "/account/profile", label: "profile" },
  { href: "/my-listings", label: "myListings" },
  { href: "/account/seller", label: "sellerDashboard" },
  { href: "/conversations", label: "messages" },
  { href: "/notifications", label: "notifications" },
  { href: "/account/saved-searches", label: "savedSearches" },
  { href: "/account/children", label: "childProfiles" },
  { href: "/favorites", label: "favorites" },
  { href: "/account/password", label: "security" }
];

export function getLocationLabel(value: string): string {
  return locationOptions.find((option) => option.value === value)?.label ?? "İstanbul";
}

export type RagQueryAnalysis = {
  originalQuery: string;
  normalizedQuery: string;
  retrievalQuery: string;
  tokens: string[];
  productTerms: string[];
  ageSignals: string[];
  locationSignals: string[];
  topicHints: string[];
};

const TURKISH_CITIES = [
  "istanbul",
  "ankara",
  "izmir",
  "bursa",
  "antalya",
  "konya",
  "kocaeli",
  "sakarya",
  "eskişehir",
  "eskisehir",
  "adana"
] as const;

const STOP_WORDS = new Set([
  "bir",
  "bu",
  "da",
  "de",
  "için",
  "ile",
  "mi",
  "mı",
  "mu",
  "mü",
  "ne",
  "neler",
  "nasıl",
  "var",
  "ve",
  "ya",
  "hangi",
  "bakayım",
  "bakmalıyım",
  "alırken",
  "alınır",
  "almalı",
  "lazım"
]);

const PRODUCT_PATTERNS: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: "bebek arabası", patterns: [/bebek\s+arabas[ıi]/iu, /\bpuset\b/iu, /\bstroller\b/iu] },
  { canonical: "oto koltuğu", patterns: [/oto\s+koltu[ğg]u/iu, /oto\s+koltugu/iu, /çocuk\s+koltu[ğg]u/iu, /cocuk\s+koltugu/iu] },
  { canonical: "ana kucağı", patterns: [/ana\s*kuca[ğg][ıi]/iu, /anakuca[ğg][ıi]/iu, /ana\s*kucagi/iu, /anakucagi/iu] },
  { canonical: "mama sandalyesi", patterns: [/mama\s+sandalyesi/iu] },
  { canonical: "oyuncak", patterns: [/oyuncak/iu, /montessori/iu] },
  { canonical: "beşik", patterns: [/be[şs]ik/iu, /beşik/iu] },
  { canonical: "park yatak", patterns: [/park\s+yatak/iu] },
  { canonical: "tekstil", patterns: [/tekstil/iu, /k[ıi]yafet/iu, /elbise/iu, /mont/iu] },
  { canonical: "ayakkabı", patterns: [/ayakkab[ıi]/iu] },
  { canonical: "scooter", patterns: [/scooter/iu] },
  { canonical: "bisiklet", patterns: [/bisiklet/iu] },
  { canonical: "kanguru", patterns: [/kanguru/iu] },
  { canonical: "taşıma çantası", patterns: [/ta[şs][ıi]ma\s+[çc]antas[ıi]/iu] },
  { canonical: "biberon", patterns: [/biberon/iu] },
  { canonical: "sterilizatör", patterns: [/sterilizat[öo]r/iu] }
];

const SYNONYM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bbebek\s+arabasi\b/giu, "bebek arabası"],
  [/\bstroller\b/giu, "bebek arabası"],
  [/\bpuset\b/giu, "bebek arabası"],
  [/\boto\s+koltugu\b/giu, "oto koltuğu"],
  [/\bcocuk\s+koltugu\b/giu, "çocuk koltuğu"],
  [/\bana\s*kucagi\b/giu, "ana kucağı"],
  [/\banakucagi\b/giu, "ana kucağı"],
  [/\byeni\s+dogan\b/giu, "yenidoğan"],
  [/\btoddler\b/giu, "24-36 ay"]
];

const TOPIC_HINT_PATTERNS: Array<{ topic: string; patterns: RegExp[] }> = [
  { topic: "safe-shopping", patterns: [/güvenli/iu, /al[ıi][şs]veri[şs]/iu, /iban/iu, /teslim/iu] },
  { topic: "listing-writing", patterns: [/ilan/iu, /a[cç][ıi]klama/iu, /ba[şs]l[ıi]k/iu, /foto[ğg]raf/iu, /fiyat/iu] },
  { topic: "messaging-privacy", patterns: [/mesaj/iu, /gizlilik/iu, /telefon/iu, /e-?posta/iu] },
  { topic: "dispute-reporting", patterns: [/yanl[ıi][şs]\s+ürün/iu, /sorun/iu, /bildir/iu, /anla[şs]mazl[ıi]k/iu] },
  { topic: "seasonal-needs", patterns: [/k[ıi][şs]/iu, /yaz/iu, /mevsim/iu, /so[ğg]uk/iu, /s[ıi]cak/iu] },
  { topic: "preconception-pregnancy", patterns: [/[çc]ocuk\s+sahibi/iu, /bebek\s+sahibi/iu, /gebe\s+kal/iu, /hamile\s+kal/iu, /folik\s+asit/iu, /hamilelik/iu, /gebelik/iu, /[şs]ans[ıi]m[ıi]\s+nas[ıi]l\s+art[ıi]r/iu] },
  { topic: "pregnancy-preparation", patterns: [/trimester/iu, /do[ğg]um\s+[çc]antas[ıi]/iu, /yenido[ğg]an\s+haz[ıi]rl[ıi]k/iu] },
  { topic: "fever-care", patterns: [/ate[şs]/iu, /y[üu]ksek\s+ate[şs]/iu] },
  { topic: "diarrhea-vomiting-care", patterns: [/ishal/iu, /kus(?:tu|uyor|ma|ması|masi)/iu, /s[ıi]v[ıi]\s+kayb[ıi]/iu] },
  { topic: "cold-cough-care", patterns: [/so[ğg]uk\s+alg[ıi]nl[ıi][ğg][ıi]/iu, /nezle/iu, /[öo]ks[üu]r[üu]k/iu] },
  { topic: "teething-care", patterns: [/di[şs]\s+[çc][ıi]kar/iu, /di[şs]\s+ka[şs][ıi]y[ıi]c[ıi]/iu] },
  { topic: "feeding-food-safety", patterns: [/ek\s*g[ıi]da/iu, /tamamlay[ıi]c[ıi]\s+beslenme/iu, /ne\s+yer\b/iu, /ne\s+yedirilir\b/iu, /ne\s+yedireyim\b/iu, /\bbal\b/iu, /\btuz\b/iu, /\b[şs]eker\b/iu, /parmak\s+g[ıi]da/iu, /p[üu]re/iu, /p[üu]t[üu]rl[üu]/iu] },
  { topic: "medicine-boundary", patterns: [/ila[cç]/iu, /doz/iu, /calpol/iu, /dolven/iu, /parasetamol/iu, /ibuprofen/iu, /antibiyotik/iu] },
  { topic: "recall-safety", patterns: [/geri\s+[çc]a[ğg][ıi]rma/iu, /seri\s+numaras[ıi]/iu, /uyar[ıi]/iu] },
  { topic: "second-hand-risk", patterns: [/ikinci\s+el/iu, /kesin\s+güvenli/iu, /kaza/iu, /[çc]arp[ıi][şs]ma/iu] },
  { topic: "assistant-boundaries", patterns: [/doktor/iu, /tan[ıi]/iu, /tedavi/iu, /ila[çc]/iu, /sistem\s+prompt/iu, /talimat/iu] }
];

export function normalizeTurkishQuery(query: string): string {
  const compact = query
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/[’‘`´]/gu, "'")
    .replace(/[“”"()[\]{}<>]/gu, " ")
    .replace(/[!?.,;:]+/gu, " ")
    .replace(/\s+/gu, " ");

  return SYNONYM_REPLACEMENTS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), compact).trim();
}

export function tokenizeRetrievalQuery(query: string): string[] {
  return unique(
    normalizeTurkishQuery(query)
      .split(/\s+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
  );
}

export function extractProductTerms(query: string): string[] {
  const normalized = normalizeTurkishQuery(query);
  return PRODUCT_PATTERNS
    .filter((entry) => entry.patterns.some((pattern) => pattern.test(normalized)))
    .map((entry) => entry.canonical);
}


export function extractAgeSignals(query: string): string[] {
  const normalized = normalizeTurkishQuery(query);
  const signals = new Set<string>();

  if (/(^|\s)(yeni\s*doğan|yenidoğan|newborn)(\s|$)/u.test(normalized)) {
    signals.add("yenidoğan");
  }

  if (/(^|\s)toddler(\s|$)/u.test(normalized)) {
    signals.add("toddler");
  }

  if (/(^|\s)okul\s*öncesi(\s|$)/u.test(normalized)) {
    signals.add("okul öncesi");
  }

  for (const match of normalized.matchAll(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*ay/gu)) {
    signals.add(`${match[1]}-${match[2]} ay`);
  }

  for (const match of normalized.matchAll(/(\d{1,2})\s*(?:aylık|aylik|ay)/gu)) {
    signals.add(`${match[1]} ay`);
  }

  for (const match of normalized.matchAll(/(\d{1,2})\s*(?:yaşındaki|yasindaki|yaşında|yasinda|yaş|yas)/gu)) {
    signals.add(`${match[1]} yaş`);
  }

  return Array.from(signals);
}

export function extractLocationSignals(query: string): string[] {
  const normalized = normalizeTurkishQuery(query);
  return TURKISH_CITIES
    .filter((city) => new RegExp(`\\b${escapeRegExp(city)}(?:'da|'de|da|de)?\\b`, "iu").test(normalized))
    .map((city) => city === "eskisehir" ? "eskişehir" : city);
}

export function extractIntentTopicHints(query: string): string[] {
  const normalized = normalizeTurkishQuery(query);
  const products = extractProductTerms(normalized);
  const ageSignals = extractAgeSignals(normalized);
  const hints = TOPIC_HINT_PATTERNS
    .filter((entry) => entry.patterns.some((pattern) => pattern.test(normalized)))
    .map((entry) => entry.topic);

  if (products.some((product) => product === "bebek arabası")) {
    hints.push("stroller-safety", "product-buying");
  }

  if (products.some((product) => product === "oto koltuğu")) {
    hints.push("car-seat-safety", "second-hand-risk");
  }

  if (products.some((product) => product === "oyuncak")) {
    hints.push("toy-safety", "product-buying");
  }

  if (products.some((product) => ["beşik", "park yatak"].includes(product))) {
    hints.push("sleep-product-safety", "second-hand-risk");
  }

  if (products.some((product) => ["tekstil", "ayakkabı"].includes(product))) {
    hints.push("textile-hygiene");
  }

  if (ageSignals.length > 0 && !hints.includes("feeding-food-safety")) {
    hints.push("age-based-needs");
  }

  if (/babyloop|favori|kay[ıi]tl[ıi]\s+arama|nas[ıi]l\s+kullan/iu.test(normalized)) {
    hints.push("marketplace-usage");
  }

  return unique(hints);
}

export function buildRetrievalQuery(originalQuery: string): RagQueryAnalysis {
  const normalizedQuery = normalizeTurkishQuery(originalQuery);
  const productTerms = extractProductTerms(normalizedQuery);
  const ageSignals = extractAgeSignals(normalizedQuery);
  const locationSignals = extractLocationSignals(normalizedQuery);
  const topicHints = extractIntentTopicHints(normalizedQuery);
  const tokens = tokenizeRetrievalQuery([
    normalizedQuery,
    productTerms.join(" "),
    ageSignals.join(" "),
    topicHints.join(" ")
  ].join(" "));
  const retrievalQuery = unique([
    normalizedQuery,
    ...productTerms,
    ...ageSignals,
    ...topicHints,
    ...(topicHints.includes("feeding-food-safety") ? ["ek gıda", "tamamlayıcı beslenme", "gıda güvenliği"] : [])
  ].filter(Boolean)).join(" ");

  return {
    originalQuery,
    normalizedQuery,
    retrievalQuery,
    tokens,
    productTerms,
    ageSignals,
    locationSignals,
    topicHints
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

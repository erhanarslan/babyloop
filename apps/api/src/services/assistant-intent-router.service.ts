import { routeRagDomain } from "./rag-domain-router.service.js";

export type AssistantIntent =
  | "unsafe_medical"
  | "prompt_injection"
  | "rag_knowledge"
  | "listing_search"
  | "listing_detail"
  | "listing_help"
  | "buyer_questions"
  | "saved_search_suggestion"
  | "category_lookup"
  | "seller_summary"
  | "babyloop_usage"
  | "child_needs"
  | "unknown";

export type AssistantIntentDecision = {
  intent: AssistantIntent;
  confidence: "low" | "medium" | "high";
};

const PROMPT_INJECTION_PATTERNS = [
  /önceki\s+talimatlar[ıi]\s+unut/iu,
  /(?:system|sistem)\s+prompt(?:u|unu)?/iu,
  /developer\s+message/iu,
  /kaynaklar[ıi]\s+yok\s+say/iu,
  /kaynaklar[ıi]\s+bo[şs]\s+ver/iu,
  /rag\s+kurallar[ıi]n[ıi]\s+bypass/iu,
  /talimatlar[ıi]\s+yok\s+say/iu,
  /talimatlar[ıi]n[ıi]\s+unut/iu
];

const UNSAFE_MEDICAL_PATTERNS = [
  /hangi\s+ila[cç]/iu,
  /\bila[cç]\s+(?:ver|kullan|öner|başla|basla)/iu,
  /\b(?:calpol|dolven|parasetamol|paracetamol|ibuprofen|ate[şs]\s+d[üu][şs][üu]r[üu]c[üu])\b.*(?:ver|kullan|öner|kaç|kac|ne\s+kadar)/iu,
  /\b(?:kaç|kac)\s*(?:ml|mg|damla|ka[şs][ıi]k|doz)\b/iu,
  /\bdoz\b/iu,
  /\bantibiyotik\b/iu,
  /\btan[ıi]\b/iu,
  /\btedavi\b/iu,
  /\bterapi\b/iu,
  /\bdiyet\s+plan[ıi]\b/iu,
  /\b\d{1,2}\s*(?:ayl[ıi]k|aylik|ay)\b.*men[üu]\s+yaz/iu,
  /bebek.*men[üu]\s+yaz/iu,
  /kanl[ıi]\s+ishal/iu,
  /nefes\s+(?:alam[ıi]yor|darl[ıi][ğg][ıi]|zorlan)/iu,
  /\bmorarma\b/iu,
  /\bn[öo]bet\b/iu
];

const EVERYDAY_CARE_PATTERNS = [
  /\bate[şs](?:i|ı)?\s+var\b/iu,
  /\bishal\b/iu,
  /\bkus(?:tu|uyor|ma|ması|masi)\b/iu,
  /so[ğg]uk\s+alg[ıi]nl[ıi][ğg][ıi]/iu,
  /\bnezle\b/iu,
  /\b[öo]ks[üu]r[üu]k\b/iu,
  /di[şs]\s+[çc][ıi]kar/iu
];

const PRECONCEPTION_PREGNANCY_PATTERNS = [
  /[çc]ocuk\s+sahibi/iu,
  /bebek\s+sahibi/iu,
  /gebe\s+kal/iu,
  /hamile\s+kal/iu,
  /hamilelik/iu,
  /gebelik/iu,
  /folik\s+asit/iu,
  /trimester/iu,
  /do[ğg]um\s+[çc]antas[ıi]/iu,
  /[şs]ans[ıi]m[ıi]\s+nas[ıi]l\s+art[ıi]r/iu
];

const LISTING_SEARCH_PATTERNS = [
  /\bilan\s+ara/iu,
  /\bar[ıi]yorum\b/iu,
  /\bvar\s+m[ıi]\b/iu,
  /\bistanbul(?:'da|da)?\b.*\b(bebek|oto|oyuncak|mama|park)/iu,
  /\bankara(?:'da|da)?\b.*\b(bebek|oto|oyuncak|mama|park)/iu
];

const LISTING_DETAIL_PATTERNS = [
  /\bbu\s+ilan\b/iu,
  /\bilan\s+detay/iu,
  /\blisting[-_\s]?[a-z0-9]/iu,
  /\bilan\s+id\b/iu
];
const BUYER_QUESTIONS_PATTERNS = [/sat[ıi]c[ıi]ya\s+ne\s+sor/iu, /hangi\s+sorular[ıi]\s+sor/iu, /ne\s+sormal[ıi]y[ıi]m/iu];
const SAVED_SEARCH_PATTERNS = [/aramay[ıi]\s+kaydet/iu, /kaydetmek\s+istiyorum/iu, /takip\s+etmek\s+istiyorum/iu, /haber\s+ver/iu];
const CATEGORY_LOOKUP_PATTERNS = [/hangi\s+kategori/iu, /kategoriye\s+koy/iu, /kategori\s+ne/iu];
const SELLER_SUMMARY_PATTERNS = [/sat[ıi]c[ıi]\s+güvenilir/iu, /sat[ıi]c[ıi]\s+özet/iu, /bu\s+sat[ıi]c[ıi]/iu];
const LISTING_HELP_PATTERNS = [/ilan\s+a[cç][ıi]klamas[ıi]/iu, /ilan.*yaz/iu, /foto/iu, /fiyat/iu, /satmak/iu, /ilan\s+haz[ıi]rla/iu];
const BABYLOOP_USAGE_PATTERNS = [/babyloop/iu, /favori/iu, /kay[ıi]tl[ıi]\s+arama/iu, /mesajla[şs]ma/iu, /nas[ıi]l\s+kullan/iu];
const CHILD_NEEDS_PATTERNS = [/\b\d{1,2}\s*(?:ayl[ıi]k|ya[şs])/iu, /ya[şs]\s+dönemi/iu, /çocu[ğg]um/iu];
const RAG_KNOWLEDGE_PATTERNS = [
  /bebek arabas[ıi]/iu,
  /oto koltu/iu,
  /oyuncak/iu,
  /be[şs]ik/iu,
  /güvenli/iu,
  /kontrol/iu,
  /ate[şs]/iu,
  /ishal/iu,
  /kus(?:tu|uyor|ma)/iu,
  /gebe\s+kal/iu,
  /hamilelik/iu,
  /gebelik/iu,
  /[çc]ocuk\s+sahibi/iu,
  /bebek\s+sahibi/iu,
  /[şs]ans[ıi]m[ıi]\s+nas[ıi]l\s+art[ıi]r/iu,
  /di[şs]\s+[çc][ıi]kar/iu
];

export function routeAssistantIntent(message: string): AssistantIntentDecision {
  const normalized = message.trim().toLocaleLowerCase("tr");
  const domainDecision = routeRagDomain(message);

  if (matchesAny(normalized, PROMPT_INJECTION_PATTERNS)) {
    return { intent: "prompt_injection", confidence: "high" };
  }

  if (matchesAny(normalized, UNSAFE_MEDICAL_PATTERNS)) {
    return { intent: "unsafe_medical", confidence: "high" };
  }

  if (domainDecision.domain === "medicine") {
    return { intent: "unsafe_medical", confidence: "high" };
  }

  if (matchesAny(normalized, LISTING_SEARCH_PATTERNS)) {
    return { intent: "listing_search", confidence: "medium" };
  }

  if (matchesAny(normalized, LISTING_DETAIL_PATTERNS)) {
    return { intent: "listing_detail", confidence: "medium" };
  }

  if (matchesAny(normalized, BUYER_QUESTIONS_PATTERNS)) {
    return { intent: "buyer_questions", confidence: "high" };
  }

  if ((domainDecision.domain === "child_product_needs" || isExplicitChildProductNeed(normalized)) && matchesAny(normalized, CHILD_NEEDS_PATTERNS)) {
    return { intent: "child_needs", confidence: "high" };
  }

  if (matchesAny(normalized, SAVED_SEARCH_PATTERNS)) {
    return { intent: "saved_search_suggestion", confidence: "high" };
  }

  if (matchesAny(normalized, CATEGORY_LOOKUP_PATTERNS)) {
    return { intent: "category_lookup", confidence: "high" };
  }

  if (matchesAny(normalized, SELLER_SUMMARY_PATTERNS)) {
    return { intent: "seller_summary", confidence: "medium" };
  }

  if (matchesAny(normalized, LISTING_HELP_PATTERNS)) {
    return { intent: "listing_help", confidence: "medium" };
  }

  if (["feeding", "illness", "safe_sleep", "product_safety", "product_recall", "car_seat", "pregnancy"].includes(domainDecision.domain)) {
    return { intent: "rag_knowledge", confidence: domainDecision.confidence };
  }

  if (matchesAny(normalized, EVERYDAY_CARE_PATTERNS) || matchesAny(normalized, PRECONCEPTION_PREGNANCY_PATTERNS)) {
    return { intent: "rag_knowledge", confidence: "high" };
  }

  if (matchesAny(normalized, BABYLOOP_USAGE_PATTERNS)) {
    return { intent: "babyloop_usage", confidence: "medium" };
  }

  if (matchesAny(normalized, RAG_KNOWLEDGE_PATTERNS)) {
    return { intent: "rag_knowledge", confidence: "medium" };
  }

  return { intent: "unknown", confidence: "low" };
}

function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function isExplicitChildProductNeed(value: string): boolean {
  return [
    /[üu]r[üu]n(?:ler|leri)?/iu,
    /\boyuncak\b/iu,
    /\bmontessori\b/iu,
    /\bihtiya[çc]\b/iu,
    /ne\s+almal[ıi]y[ıi]m/iu,
    /\bk[ıi][şs]l[ıi]k\b/iu,
    /takip\s+etmek/iu
  ].some((pattern) => pattern.test(value));
}

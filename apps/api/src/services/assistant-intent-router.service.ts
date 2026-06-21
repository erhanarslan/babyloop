export type AssistantIntent =
  | "unsafe_medical"
  | "prompt_injection"
  | "rag_knowledge"
  | "listing_search"
  | "listing_help"
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
  /rag\s+kurallar[ıi]n[ıi]\s+bypass/iu,
  /talimatlar[ıi]\s+yok\s+say/iu,
  /talimatlar[ıi]n[ıi]\s+unut/iu
];

const UNSAFE_MEDICAL_PATTERNS = [
  /hangi\s+ila[cç]/iu,
  /\bila[cç]\s+(?:ver|kullan|öner)/iu,
  /\bdoz\b/iu,
  /\btan[ıi]\b/iu,
  /\btedavi\b/iu,
  /\bterapi\b/iu,
  /\bdiyet\s+plan[ıi]\b/iu,
  /\bate[şs]/iu
];

const LISTING_SEARCH_PATTERNS = [
  /\bilan\s+ara/iu,
  /\bar[ıi]yorum\b/iu,
  /\bvar\s+m[ıi]\b/iu,
  /\bistanbul(?:'da|da)?\b.*\b(bebek|oto|oyuncak|mama|park)/iu,
  /\bankara(?:'da|da)?\b.*\b(bebek|oto|oyuncak|mama|park)/iu
];

const LISTING_HELP_PATTERNS = [/ilan/iu, /a[cç][ıi]klama/iu, /foto/iu, /fiyat/iu, /satmak/iu];
const BABYLOOP_USAGE_PATTERNS = [/babyloop/iu, /favori/iu, /kay[ıi]tl[ıi]\s+arama/iu, /mesajla[şs]ma/iu, /nas[ıi]l\s+kullan/iu];
const CHILD_NEEDS_PATTERNS = [/\b\d{1,2}\s*(?:ayl[ıi]k|ya[şs])/iu, /ya[şs]\s+dönemi/iu, /çocu[ğg]um/iu];
const RAG_KNOWLEDGE_PATTERNS = [/bebek arabas[ıi]/iu, /oto koltu/iu, /oyuncak/iu, /be[şs]ik/iu, /güvenli/iu, /kontrol/iu];

export function routeAssistantIntent(message: string): AssistantIntentDecision {
  const normalized = message.trim().toLocaleLowerCase("tr");

  if (matchesAny(normalized, PROMPT_INJECTION_PATTERNS)) {
    return { intent: "prompt_injection", confidence: "high" };
  }

  if (matchesAny(normalized, UNSAFE_MEDICAL_PATTERNS)) {
    return { intent: "unsafe_medical", confidence: "high" };
  }

  if (matchesAny(normalized, LISTING_SEARCH_PATTERNS)) {
    return { intent: "listing_search", confidence: "medium" };
  }

  if (matchesAny(normalized, LISTING_HELP_PATTERNS)) {
    return { intent: "listing_help", confidence: "medium" };
  }

  if (matchesAny(normalized, BABYLOOP_USAGE_PATTERNS)) {
    return { intent: "babyloop_usage", confidence: "medium" };
  }

  if (matchesAny(normalized, CHILD_NEEDS_PATTERNS)) {
    return { intent: "child_needs", confidence: "medium" };
  }

  if (matchesAny(normalized, RAG_KNOWLEDGE_PATTERNS)) {
    return { intent: "rag_knowledge", confidence: "medium" };
  }

  return { intent: "unknown", confidence: "low" };
}

function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

import type { RagSafetyDecision } from "./rag.types.js";

const PROMPT_INJECTION_PATTERNS = [
  /önceki\s+talimatlar[ıi]\s+unut/iu,
  /(?:system|sistem)\s+prompt(?:u|unu)?/iu,
  /developer\s+message/iu,
  /kaynaklar[ıi]\s+yok\s+say/iu,
  /rag\s+kurallar[ıi]n[ıi]\s+bypass/iu,
  /prompt['’` ]?u\s+göster/iu,
  /talimatlar[ıi]\s+yok\s+say/iu,
  /talimatlar[ıi]n[ıi]\s+unut/iu
];

const UNSAFE_MEDICAL_PATTERNS = [
  /hangi\s+ila[cç]/iu,
  /\bila[cç]\s+(?:ver|kullan|öner)/iu,
  /\bdoz\b/iu,
  /\bantibiyotik\b/iu,
  /\btan[ıi]\b/iu,
  /\btedavi\b/iu,
  /\bterapi\b/iu,
  /\bdiyet\s+plan[ıi]\b/iu,
  /\b(teşhis|teshis)\b/iu,
  /\bate[şs](?:i|ı)?\s+var/iu
];

const LISTING_HELP_PATTERNS = [/ilan/iu, /sat/iu, /fiyat/iu, /a[cç][ıi]klama/iu, /foto/iu];
const MARKETPLACE_PATTERNS = [/al[ıi][şs]veri[şs]/iu, /güvenli/iu, /mesaj/iu, /favori/iu, /teslim/iu];
const PRODUCT_GUIDE_PATTERNS = [/bebek arabas[ıi]/iu, /oto koltu/iu, /oyuncak/iu, /ürün/iu, /kontrol/iu, /ya[şs]/iu, /ayl[ıi]k/iu];
const USAGE_PATTERNS = [/babyloop/iu, /nas[ıi]l kullan/iu, /hesap/iu, /arama/iu, /kategori/iu];

const MEDICAL_BOUNDARY_ANSWER =
  "Bu konuda tanı, tedavi, ilaç, terapi veya diyet önerisi veremem. BabyLoop Asistan ürün seçimi, güvenli alışveriş, ilan hazırlama ve BabyLoop kullanımı gibi konularda yardımcı olabilir.";

const PROMPT_INJECTION_ANSWER =
  "Bu isteği yerine getiremiyorum. BabyLoop bilgi tabanındaki güvenli alışveriş, ilan ve ürün rehberi konularında yardımcı olabilirim.";

export function decideRagSafety(message: string): RagSafetyDecision {
  const normalized = message.trim();

  if (matchesAny(normalized, PROMPT_INJECTION_PATTERNS)) {
    return {
      allowed: false,
      reason: "prompt_injection",
      boundaryAnswer: PROMPT_INJECTION_ANSWER
    };
  }

  if (matchesAny(normalized, UNSAFE_MEDICAL_PATTERNS)) {
    return {
      allowed: false,
      reason: "unsafe_medical",
      boundaryAnswer: MEDICAL_BOUNDARY_ANSWER
    };
  }

  if (matchesAny(normalized, LISTING_HELP_PATTERNS)) {
    return {
      allowed: true,
      reason: "listing_help"
    };
  }

  if (matchesAny(normalized, MARKETPLACE_PATTERNS)) {
    return {
      allowed: true,
      reason: "marketplace"
    };
  }

  if (matchesAny(normalized, PRODUCT_GUIDE_PATTERNS)) {
    return {
      allowed: true,
      reason: "parent_product_guide"
    };
  }

  if (matchesAny(normalized, USAGE_PATTERNS)) {
    return {
      allowed: true,
      reason: "babyloop_usage"
    };
  }

  return {
    allowed: true,
    reason: "unknown"
  };
}

function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

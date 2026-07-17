import type { RagSafetyDecision } from "./rag.types.js";

const PROMPT_INJECTION_PATTERNS = [
  /önceki\s+talimatlar[ıi]\s+unut/iu,
  /(?:system|sistem)\s+prompt(?:u|unu)?/iu,
  /developer\s+message/iu,
  /kaynaklar[ıi]\s+yok\s+say/iu,
  /kaynaklar[ıi]\s+bo[şs]\s+ver/iu,
  /rag\s+kurallar[ıi]n[ıi]\s+bypass/iu,
  /prompt['’` ]?u\s+göster/iu,
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
  /kilo\s+ald[ıi]ran\s+men[üu]/iu,
  /kilo\s+ald[ıi]ran\s+(?:özel\s+)?diyet/iu,
  /\bd[öo]k[üu]nt[üu]\s+ne\b/iu,
  /\balerji\s+ila[cç]/iu,
  /\b(teşhis|teshis)\b/iu,
  /kanl[ıi]\s+ishal/iu,
  /nefes\s+(?:alam[ıi]yor|darl[ıi][ğg][ıi]|zorlan)/iu,
  /\bmorarma\b/iu,
  /\bn[öo]bet\b/iu,
  /bilin[cç]\s+(?:kayb[ıi]|de[ğg]i[şs]ikli[ğg]i)/iu,
  /\bzehirlenme\b/iu,
  /alerjik\s+reaksiyon/iu,
  /s[ıi]v[ıi]\s+alam[ıi]yor/iu
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
  /gebe\s+kal/iu,
  /hamile\s+kal/iu,
  /hamilelik/iu,
  /gebelik/iu,
  /folik\s+asit/iu,
  /trimester/iu,
  /do[ğg]um\s+[çc]antas[ıi]/iu
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

  if (matchesAny(normalized, EVERYDAY_CARE_PATTERNS)) {
    return {
      allowed: true,
      reason: "everyday_care"
    };
  }

  if (matchesAny(normalized, PRECONCEPTION_PREGNANCY_PATTERNS)) {
    return {
      allowed: true,
      reason: "preconception_pregnancy"
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

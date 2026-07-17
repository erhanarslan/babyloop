import {
  getRagAnswerOwnerPolicy,
  type RagAnswerOwnerDomain,
  type RagAnswerOwnerPolicy,
  type RagToolPolicy
} from "./rag-answer-owner-registry.js";
import { normalizeTurkishQuery } from "./rag-query-normalizer.service.js";

export type RagDomainDecision = {
  domain: RagAnswerOwnerDomain;
  confidence: "high" | "medium" | "low";
  matchedSignals: string[];
  rejectedDomains: RagAnswerOwnerDomain[];
  highRisk: boolean;
  healthLike: boolean;
  productLike: boolean;
  marketplaceLike: boolean;
  canonicalOwner: string | null;
  allowedTopics: string[];
  forbiddenTopics: string[];
  allowedSourcePaths: string[];
  forbiddenSourcePaths: string[];
  allowedSafetyScopes: string[];
  minimumReliability: RagAnswerOwnerPolicy["minimumReliability"];
  minimumSourceCount: number;
  requireCanonicalOwner: boolean;
  toolPolicy: RagToolPolicy;
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

const MEDICAL_BLOCK_PATTERNS = [
  /\b(?:ila[cç]|antibiyotik|calpol|dolven|parasetamol|ibuprofen)\b/iu,
  /\b(?:kaç|kac)\s*(?:ml|mg|damla|ka[şs][ıi]k|doz)\b/iu,
  /\b(?:tan[ıi]|tedavi|terapi)\b/iu,
  /haftal[ıi]k\s+(?:men[üu]|diyet)/iu,
  /\b\d{1,2}\s*(?:ayl[ıi]k|aylik|ay)\b.*men[üu]\s+yaz/iu,
  /bebek.*men[üu]\s+yaz/iu,
  /kilo\s+ald[ıi]ran\s+men[üu]/iu,
  /kilo\s+ald[ıi]ran\s+(?:özel\s+)?diyet/iu,
  /kişiselleştirilmiş\s+diyet/iu,
  /kisisellestirilmis\s+diyet/iu
];

const ILLNESS_PATTERNS = [
  /\bishal\b/iu,
  /\bkus(?:tu|uyor|ma|ması|masi)\b/iu,
  /\bate[şs]/iu,
  /\b[öo]ks[üu]r[üu]k\b/iu,
  /\bnezle\b/iu,
  /nefes\s+(?:alam[ıi]yor|darl[ıi][ğg][ıi]|zorlan)/iu,
  /\bmorarma\b/iu,
  /\bn[öo]bet\b/iu,
  /kanl[ıi]\s+ishal/iu
];

const FEEDING_PATTERNS = [
  /ek\s*g[ıi]da/iu,
  /tamamlay[ıi]c[ıi]\s+beslenme/iu,
  /ne\s+yer\b/iu,
  /ne\s+yedirilir\b/iu,
  /ne\s+yedireyim\b/iu,
  /hangi\s+g[ıi]da/iu,
  /parmak\s+g[ıi]da/iu,
  /p[üu]re/iu,
  /p[üu]t[üu]rl[üu]/iu,
  /\bbal\b/iu,
  /\btuz\b/iu,
  /\b[şs]eker\b/iu,
  /\b[öo][ğg][üu]n\b/iu,
  /\bbesin\b/iu,
  /\byemek\b/iu,
  /\bmama\b/iu,
  /\bbiberon\b/iu
];

const PRODUCT_INTENT_PATTERNS = [
  /\boyuncak\b/iu,
  /\bmontessori\b/iu,
  /[üu]r[üu]n(?:ler|leri)?/iu,
  /ne\s+almal[ıi]y[ıi]m/iu,
  /ne\s+almal[ıi]/iu,
  /\bihtiya[çc]\b/iu,
  /\bk[ıi]yafet\b/iu,
  /bebek\s+arabas[ıi]/iu,
  /oto\s+koltu[ğg]u/iu,
  /\bkategori\b/iu,
  /\bilan\b/iu,
  /sat[ıi]n\s+al/iu,
  /ikinci\s+el/iu,
  /aktivite\s+[üu]r[üu]n[üu]/iu,
  /geli[şs]im\s+oyunca[ğg][ıi]/iu,
  /mama\s+sandalyesi/iu
];

const MARKETPLACE_PATTERNS = [
  /\bilan\s+ara/iu,
  /\bar[ıi]yorum\b/iu,
  /\bvar\s+m[ıi]\b/iu,
  /arama(?:y[ıi])?\s+kaydet/iu,
  /favori/iu,
  /babyloop/iu
];

const SAFE_SLEEP_PATTERNS = [
  /s[ıi]rt[üu]st[üu]/iu,
  /be[şs]ik/iu,
  /park\s+yatak/iu,
  /ana\s*kuca[ğg][ıi]nda\s+uyu/iu,
  /uyku\s+(?:güvenli|yüzeyi|ürünü)/iu,
  /yast[ıi]k|battaniye|bumper/iu
];

const PREGNANCY_PATTERNS = [
  /hamilelik/iu,
  /gebelik/iu,
  /gebe\s+kal/iu,
  /hamile\s+kal/iu,
  /folik\s+asit/iu,
  /trimester/iu
];

const AGE_CONTEXT_PATTERNS = [
  /\b\d{1,2}\s*(?:ayl[ıi]k|aylik|ay)\b/iu,
  /\balt[ıi]\s+ayl[ıi]k\b/iu,
  /\berkek\s+bebek\b/iu,
  /\bk[ıi]z\s+bebek\b/iu,
  /\bçocu[ğg]um\b/iu
];

export const RAG_DOMAIN_ROUTER_VERSION = "rag-domain-router-v2";

export function routeRagDomain(message: string): RagDomainDecision {
  const normalized = normalizeTurkishQuery(message);
  const matchedSignals: string[] = [];
  const rejectedDomains: RagAnswerOwnerDomain[] = [];
  const productLike = hasAny(normalized, PRODUCT_INTENT_PATTERNS);
  const marketplaceLike = hasAny(normalized, MARKETPLACE_PATTERNS);
  const ageOnly = hasAny(normalized, AGE_CONTEXT_PATTERNS) && !productLike;

  if (hasAny(normalized, PROMPT_INJECTION_PATTERNS)) {
    return buildDecision("unknown", "high", ["prompt_injection"], ["marketplace", "child_product_needs"], true, false, false, false);
  }

  if (hasAny(normalized, MEDICAL_BLOCK_PATTERNS)) {
    return buildDecision("medicine", "high", ["medical_boundary"], ["marketplace", "child_product_needs"], true, true, productLike, marketplaceLike);
  }

  if (hasAny(normalized, ILLNESS_PATTERNS)) {
    return buildDecision("illness", "high", ["illness_signal"], ["marketplace", "child_product_needs", "feeding"], true, true, productLike, marketplaceLike);
  }

  const hasFeeding = hasAny(normalized, FEEDING_PATTERNS) && !/mama\s+sandalyesi/iu.test(normalized);

  if (hasFeeding) {
    rejectedDomains.push("child_product_needs");

    if (productLike || marketplaceLike) {
      rejectedDomains.push("marketplace");
    }

    return buildDecision("feeding", "high", [...(ageOnly ? ["age_context"] : []), "feeding_signal"], rejectedDomains, false, true, productLike, marketplaceLike);
  }

  if (hasAny(normalized, SAFE_SLEEP_PATTERNS)) {
    return buildDecision("safe_sleep", "high", ["safe_sleep_signal"], ["marketplace", "child_product_needs"], true, true, productLike, marketplaceLike);
  }

  if (/sat[ıi]c[ıi]ya\s+ne\s+sor|hangi\s+sorular[ıi]\s+sor|ne\s+sormal[ıi]y[ıi]m/iu.test(normalized)) {
    return buildDecision("buyer_questions", "high", ["buyer_questions_signal"], ["feeding"], false, false, productLike, true);
  }

  if (/oto\s+koltu[ğg]u|çocuk\s+koltu[ğg]u/iu.test(normalized)) {
    return buildDecision("car_seat", "high", ["car_seat_signal"], ["feeding"], false, false, true, marketplaceLike);
  }

  if (/geri\s+[çc]a[ğg][ıi]rma|seri\s+numaras[ıi]|[üu]r[üu]n\s+uyar[ıi]s[ıi]/iu.test(normalized)) {
    return buildDecision("product_recall", "high", ["recall_signal"], ["feeding"], false, false, true, marketplaceLike);
  }

  if (hasAny(normalized, PREGNANCY_PATTERNS)) {
    return buildDecision("pregnancy", "medium", ["pregnancy_signal"], ["child_product_needs"], false, true, productLike, marketplaceLike);
  }

  if (/ilan\s+a[çc][ıi]klamas[ıi]|ilan.*yaz|foto[ğg]raf|fiyat|satmak/iu.test(normalized)) {
    return buildDecision("listing_help", "high", ["listing_help_signal"], ["feeding"], false, false, productLike, true);
  }

  if (marketplaceLike && productLike) {
    return buildDecision("marketplace", "medium", ["marketplace_signal"], ["feeding"], false, false, true, true);
  }

  if (productLike) {
    return buildDecision("child_product_needs", ageOnly ? "medium" : "high", ["product_need_signal"], ["feeding"], false, false, true, marketplaceLike);
  }

  if (marketplaceLike) {
    return buildDecision("babyloop_usage", "medium", ["babyloop_usage_signal"], ["feeding"], false, false, false, true);
  }

  return buildDecision("unknown", "low", [], ["child_product_needs"], false, false, false, false);
}

export function createRagDomainDecisionFromDomain(
  domain: RagAnswerOwnerDomain,
  confidence: "high" | "medium" | "low" = "medium",
  matchedSignals: string[] = []
): RagDomainDecision {
  return buildDecision(domain, confidence, matchedSignals, [], false, ["feeding", "illness", "medicine", "safe_sleep", "pregnancy"].includes(domain), ["product_safety", "product_recall", "car_seat", "child_product_needs"].includes(domain), ["marketplace", "listing_help", "buyer_questions", "babyloop_usage"].includes(domain));
}

function buildDecision(
  domain: RagAnswerOwnerDomain,
  confidence: "high" | "medium" | "low",
  matchedSignals: string[],
  rejectedDomains: RagAnswerOwnerDomain[],
  highRisk: boolean,
  healthLike: boolean,
  productLike: boolean,
  marketplaceLike: boolean
): RagDomainDecision {
  const policy = getRagAnswerOwnerPolicy(domain);

  return {
    domain,
    confidence,
    matchedSignals,
    rejectedDomains,
    highRisk,
    healthLike,
    productLike,
    marketplaceLike,
    canonicalOwner: policy.owner,
    allowedTopics: policy.allowedTopics,
    forbiddenTopics: policy.forbiddenTopics,
    allowedSourcePaths: policy.allowedSourcePaths,
    forbiddenSourcePaths: policy.forbiddenSourcePaths,
    allowedSafetyScopes: policy.allowedSafetyScopes,
    minimumReliability: policy.minimumReliability,
    minimumSourceCount: policy.minimumSourceCount,
    requireCanonicalOwner: policy.requireCanonicalOwner,
    toolPolicy: policy.toolPolicy
  };
}

function hasAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

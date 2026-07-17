import type { RagSourceReliability } from "./rag.types.js";

export type RagAnswerOwnerDomain =
  | "feeding"
  | "illness"
  | "medicine"
  | "safe_sleep"
  | "product_safety"
  | "product_recall"
  | "car_seat"
  | "pregnancy"
  | "marketplace"
  | "listing_help"
  | "buyer_questions"
  | "child_product_needs"
  | "babyloop_usage"
  | "unknown";

export type RagToolPolicy = {
  allowedTools: string[];
  forbiddenTools: string[];
  allowChildPersonalization: boolean;
  allowMarketplaceActions: boolean;
  allowWriteDraftActions: boolean;
};

export type RagAnswerOwnerPolicy = {
  domain: RagAnswerOwnerDomain;
  owner: string | null;
  allowedSafetyScopes: string[];
  allowedSourcePaths: string[];
  allowedTopics: string[];
  forbiddenSourcePaths: string[];
  forbiddenTopics: string[];
  minimumReliability: RagSourceReliability | "any";
  minimumSourceCount: number;
  requireCanonicalOwner: boolean;
  toolPolicy: RagToolPolicy;
};

const HEALTH_FORBIDDEN_TOOLS = [
  "child_needs_recommendations",
  "saved_search_suggest_draft",
  "category_lookup",
  "listing_search",
  "listing_detail",
  "seller_public_summary",
  "listing_draft_helper"
];

const FEEDING_POLICY: RagAnswerOwnerPolicy = {
  domain: "feeding",
  owner: "feeding-and-food-safety-canon",
  allowedSafetyScopes: ["parent-health-boundary", "rag-governance"],
  allowedSourcePaths: [
    "docs/rag/44-feeding-and-food-safety-canon.md",
    "docs/rag/15-rag-source-policy.md",
    "docs/rag/43-authoritative-source-map.md",
    "docs/rag/48-rag-answer-ownership-map.md"
  ],
  allowedTopics: ["feeding-food-safety", "rag-source-policy"],
  forbiddenSourcePaths: [
    "docs/rag/05-age-based-product-needs.md",
    "docs/rag/09-toy-safety-checklist.md",
    "docs/rag/20-seasonal-needs-guide.md"
  ],
  forbiddenTopics: [
    "toy-safety",
    "product-buying",
    "seasonal-needs",
    "age-based-needs",
    "child-needs",
    "listing-writing",
    "listing-photos",
    "marketplace-usage",
    "saved-search"
  ],
  minimumReliability: "official-referenced",
  minimumSourceCount: 1,
  requireCanonicalOwner: true,
  toolPolicy: {
    allowedTools: ["rag_search"],
    forbiddenTools: HEALTH_FORBIDDEN_TOOLS,
    allowChildPersonalization: false,
    allowMarketplaceActions: false,
    allowWriteDraftActions: false
  }
};

const POLICIES: Record<RagAnswerOwnerDomain, RagAnswerOwnerPolicy> = {
  feeding: FEEDING_POLICY,
  illness: {
    ...FEEDING_POLICY,
    domain: "illness",
    owner: "illness-red-flags-boundary-canon",
    allowedSourcePaths: [
      "docs/rag/46-illness-red-flags-boundary-canon.md",
      "docs/rag/15-rag-source-policy.md",
      "docs/rag/43-authoritative-source-map.md"
    ],
    allowedTopics: ["fever-care", "diarrhea-vomiting-care", "cold-cough-care", "teething-care", "rag-source-policy"],
    forbiddenTopics: [...FEEDING_POLICY.forbiddenTopics, "feeding-food-safety"],
    requireCanonicalOwner: true
  },
  medicine: {
    ...FEEDING_POLICY,
    domain: "medicine",
    owner: "illness-red-flags-boundary-canon",
    allowedSourcePaths: ["docs/rag/46-illness-red-flags-boundary-canon.md"],
    allowedTopics: ["medicine-boundary", "fever-care"],
    requireCanonicalOwner: true
  },
  safe_sleep: {
    ...FEEDING_POLICY,
    domain: "safe_sleep",
    owner: "safe-sleep-and-product-boundary-canon",
    allowedSourcePaths: ["docs/rag/45-safe-sleep-and-product-boundary-canon.md"],
    allowedTopics: ["sleep-product-safety"],
    requireCanonicalOwner: true
  },
  product_safety: {
    domain: "product_safety",
    owner: "second-hand-product-safety-canon",
    allowedSafetyScopes: ["marketplace-guidance", "parent-health-boundary", "rag-governance"],
    allowedSourcePaths: [
      "docs/rag/47-second-hand-product-safety-canon.md",
      "docs/rag/04-product-buying-guides.md",
      "docs/rag/07-stroller-buying-checklist.md",
      "docs/rag/09-toy-safety-checklist.md",
      "docs/rag/11-crib-and-sleep-product-boundaries.md",
      "docs/rag/12-recall-and-product-warning-guide.md"
    ],
    allowedTopics: ["product-buying", "toy-safety", "stroller-safety", "sleep-product-safety", "product-recall", "second-hand-risk"],
    forbiddenSourcePaths: [],
    forbiddenTopics: ["feeding-food-safety"],
    minimumReliability: "any",
    minimumSourceCount: 1,
    requireCanonicalOwner: false,
    toolPolicy: {
      allowedTools: ["rag_search", "buyer_question_templates"],
      forbiddenTools: ["child_needs_recommendations", "saved_search_suggest_draft"],
      allowChildPersonalization: false,
      allowMarketplaceActions: false,
      allowWriteDraftActions: false
    }
  },
  product_recall: {
    ...FEEDING_POLICY,
    domain: "product_recall",
    owner: "second-hand-product-safety-canon",
    allowedSourcePaths: ["docs/rag/47-second-hand-product-safety-canon.md", "docs/rag/12-recall-and-product-warning-guide.md"],
    allowedTopics: ["product-recall", "second-hand-risk"],
    forbiddenTopics: ["feeding-food-safety"],
    minimumReliability: "official-source-note",
    requireCanonicalOwner: false
  },
  car_seat: {
    ...FEEDING_POLICY,
    domain: "car_seat",
    owner: "car-seat-second-hand-checklist",
    allowedSourcePaths: ["docs/rag/08-car-seat-second-hand-checklist.md", "docs/rag/47-second-hand-product-safety-canon.md"],
    allowedTopics: ["car-seat-safety", "second-hand-risk"],
    forbiddenTopics: ["feeding-food-safety"],
    minimumReliability: "editorial",
    requireCanonicalOwner: false
  },
  pregnancy: {
    ...FEEDING_POLICY,
    domain: "pregnancy",
    owner: null,
    allowedSourcePaths: [
      "docs/rag/31-preconception-and-fertility-basics.md",
      "docs/rag/32-pregnancy-trimester-week-by-week-preparation.md"
    ],
    allowedTopics: ["preconception-pregnancy", "pregnancy-preparation"],
    forbiddenTopics: ["feeding-food-safety", "toy-safety"],
    minimumReliability: "official-referenced",
    requireCanonicalOwner: false
  },
  marketplace: {
    domain: "marketplace",
    owner: "babyloop-marketplace-guide",
    allowedSafetyScopes: ["marketplace-guidance", "rag-governance"],
    allowedSourcePaths: [],
    allowedTopics: ["marketplace-usage", "safe-shopping", "messaging-privacy", "dispute-reporting"],
    forbiddenSourcePaths: [],
    forbiddenTopics: ["feeding-food-safety"],
    minimumReliability: "any",
    minimumSourceCount: 1,
    requireCanonicalOwner: false,
    toolPolicy: {
      allowedTools: ["rag_search", "listing_search", "listing_detail", "category_lookup", "seller_public_summary", "saved_search_suggest_draft"],
      forbiddenTools: [],
      allowChildPersonalization: false,
      allowMarketplaceActions: true,
      allowWriteDraftActions: false
    }
  },
  listing_help: {
    domain: "listing_help",
    owner: null,
    allowedSafetyScopes: ["marketplace-guidance"],
    allowedSourcePaths: [],
    allowedTopics: ["listing-writing", "listing-photos", "buyer-questions"],
    forbiddenSourcePaths: [],
    forbiddenTopics: ["feeding-food-safety"],
    minimumReliability: "any",
    minimumSourceCount: 1,
    requireCanonicalOwner: false,
    toolPolicy: {
      allowedTools: ["rag_search", "listing_draft_helper", "buyer_question_templates"],
      forbiddenTools: ["child_needs_recommendations"],
      allowChildPersonalization: false,
      allowMarketplaceActions: true,
      allowWriteDraftActions: true
    }
  },
  buyer_questions: {
    domain: "buyer_questions",
    owner: null,
    allowedSafetyScopes: ["marketplace-guidance"],
    allowedSourcePaths: [],
    allowedTopics: ["buyer-questions", "product-buying", "safe-shopping"],
    forbiddenSourcePaths: [],
    forbiddenTopics: ["feeding-food-safety"],
    minimumReliability: "any",
    minimumSourceCount: 1,
    requireCanonicalOwner: false,
    toolPolicy: {
      allowedTools: ["rag_search", "buyer_question_templates"],
      forbiddenTools: ["child_needs_recommendations"],
      allowChildPersonalization: false,
      allowMarketplaceActions: true,
      allowWriteDraftActions: false
    }
  },
  child_product_needs: {
    domain: "child_product_needs",
    owner: null,
    allowedSafetyScopes: ["marketplace-guidance"],
    allowedSourcePaths: ["docs/rag/05-age-based-product-needs.md", "docs/rag/20-seasonal-needs-guide.md"],
    allowedTopics: ["age-based-needs", "seasonal-needs", "toy-safety", "product-buying"],
    forbiddenSourcePaths: ["docs/rag/44-feeding-and-food-safety-canon.md"],
    forbiddenTopics: ["feeding-food-safety", "medicine-boundary"],
    minimumReliability: "any",
    minimumSourceCount: 1,
    requireCanonicalOwner: false,
    toolPolicy: {
      allowedTools: ["rag_search", "child_needs_recommendations", "saved_search_suggest_draft"],
      forbiddenTools: ["listing_search", "category_lookup", "listing_draft_helper"],
      allowChildPersonalization: true,
      allowMarketplaceActions: true,
      allowWriteDraftActions: true
    }
  },
  babyloop_usage: {
    domain: "babyloop_usage",
    owner: "babyloop-marketplace-guide",
    allowedSafetyScopes: ["marketplace-guidance"],
    allowedSourcePaths: [],
    allowedTopics: ["marketplace-usage", "messaging-privacy", "safe-shopping"],
    forbiddenSourcePaths: [],
    forbiddenTopics: ["feeding-food-safety"],
    minimumReliability: "internal",
    minimumSourceCount: 1,
    requireCanonicalOwner: false,
    toolPolicy: {
      allowedTools: ["rag_search"],
      forbiddenTools: ["child_needs_recommendations"],
      allowChildPersonalization: false,
      allowMarketplaceActions: false,
      allowWriteDraftActions: false
    }
  },
  unknown: {
    domain: "unknown",
    owner: null,
    allowedSafetyScopes: [],
    allowedSourcePaths: [],
    allowedTopics: [],
    forbiddenSourcePaths: [],
    forbiddenTopics: [],
    minimumReliability: "any",
    minimumSourceCount: 1,
    requireCanonicalOwner: false,
    toolPolicy: {
      allowedTools: ["rag_search"],
      forbiddenTools: ["child_needs_recommendations", "listing_search", "category_lookup"],
      allowChildPersonalization: false,
      allowMarketplaceActions: false,
      allowWriteDraftActions: false
    }
  }
};

export const RAG_OWNER_REGISTRY_VERSION = "rag-owner-registry-v2";

export function getRagAnswerOwnerPolicy(domain: RagAnswerOwnerDomain): RagAnswerOwnerPolicy {
  return POLICIES[domain];
}

export function isToolAllowedByPolicy(policy: RagAnswerOwnerPolicy, tool: string): boolean {
  if (policy.toolPolicy.forbiddenTools.includes(tool)) {
    return false;
  }

  return policy.toolPolicy.allowedTools.includes(tool);
}

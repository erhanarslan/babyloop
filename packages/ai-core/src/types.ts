export type ListingSuggestionInput = {
  title?: string;
  description?: string;
  categoryName?: string;
  condition?: string;
  listingType?: "sale" | "swap" | "donation";
};

export type ListingSuggestionOutput = {
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedCategorySlug: string | null;
  suggestedCategoryName: string | null;
  suggestedCondition: string | null;
  suggestedListingType: "sale" | "swap" | "donation";
  suggestedTags: string[];
  safetyWarnings: string[];
  missingInfoQuestions: string[];
  confidenceScore: number;
  providerName: string;
  promptVersion: string;
};

export type ListingSuggestionProvider = {
  readonly providerName: string;
  suggestListing(input: ListingSuggestionInput): Promise<ListingSuggestionOutput>;
};

export type ListingDraftSuggestionCondition = "new" | "like_new" | "good" | "fair" | "needs_repair";

export type ListingDraftSuggestionListingType = "sale" | "swap" | "donation";

export type ListingDraftSuggestionConfidence = "low" | "medium" | "high";

export type ListingDraftSuggestionImageInput = {
  id: string;
  filename?: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  dataUrl?: string;
};

export type ListingDraftSuggestionCategoryCandidate = {
  id: string;
  name: string;
  slug: string;
};

export type ListingDraftSuggestionInput = {
  locale?: "tr";
  categoryId?: string;
  categoryName?: string;
  listingType?: ListingDraftSuggestionListingType;
  title?: string;
  description?: string;
  condition?: ListingDraftSuggestionCondition;
  priceAmount?: string;
  currency?: "TRY";
  city?: string;
  images: ListingDraftSuggestionImageInput[];
  categoryCandidates: ListingDraftSuggestionCategoryCandidate[];
};

export type ListingDraftSuggestionOutput = {
  title?: string;
  description?: string;
  categoryId?: string;
  condition?: ListingDraftSuggestionCondition;
  priceSuggestion?: {
    min: number;
    max: number;
    currency: "TRY";
    confidence: ListingDraftSuggestionConfidence;
    reason: string;
  };
  imageFeedback: Array<{
    imageIdOrUrl: string;
    status: "good" | "unclear" | "possibly_irrelevant" | "needs_review";
    message: string;
  }>;
  missingDetails: string[];
  warnings: string[];
  confidence: ListingDraftSuggestionConfidence;
  providerName: string;
  promptVersion: string;
  modelName?: string;
};

export type ListingDraftSuggestionProvider = {
  readonly providerName: string;
  readonly modelName?: string;
  suggestListingDraft(input: ListingDraftSuggestionInput): Promise<ListingDraftSuggestionOutput>;
};

export type PriceSuggestionInput = {
  title?: string;
  categoryName?: string;
  condition?: string;
  listingType?: "sale" | "swap" | "donation";
  currentPriceAmount?: string;
  currency?: string;
};

export type PriceSuggestionOutput = {
  recommendedPriceAmount: string | null;
  recommendedPriceMin: string | null;
  recommendedPriceMax: string | null;
  currency: string;
  pricingMode: "suggested" | "not_applicable";
  rationale: string[];
  confidenceScore: number;
  providerName: string;
  promptVersion: string;
};

export type PriceSuggestionProvider = {
  readonly providerName: string;
  suggestPrice(input: PriceSuggestionInput): Promise<PriceSuggestionOutput>;
};

export type ModerationSummaryTargetType = "listing" | "profile" | "message";

export type ModerationSummaryInput = {
  caseId: string;
  targetType: ModerationSummaryTargetType;
  targetId: string;
  status: string;
  priority: string;
  reportReason?: string;
  targetPreview?: {
    type: ModerationSummaryTargetType;
    summary: string;
    safetyStatus?: "active" | "restricted" | "suspended";
  };
  recentTimelineLabels: string[];
  previousEnforcementActions: string[];
};

export type ModerationSummaryOutput = {
  summary: string;
  riskLevel: "low" | "medium" | "high";
  recommendedAction:
    | "dismiss_or_monitor"
    | "continue_review"
    | "hide_listing"
    | "hide_message"
    | "restrict_profile"
    | "escalate";
  rationale: string[];
  safetySignals: string[];
  confidenceScore: number;
  providerName: string;
  promptVersion: string;
  modelName?: string;
};

export type ModerationSummaryProvider = {
  readonly providerName: string;
  readonly modelName?: string;
  summarizeModerationCase(input: ModerationSummaryInput): Promise<ModerationSummaryOutput>;
};

export type ModerationSummaryGuardrailIssue = {
  field: string;
  reason: string;
};

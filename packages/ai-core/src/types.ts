export type ListingSuggestionInput = {
  title?: string;
  description?: string;
  categoryName?: string;
  condition?: string;
};

export type ListingSuggestionOutput = {
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedTags: string[];
  missingInfoQuestions: string[];
  confidenceScore: number;
  providerName: string;
  promptVersion: string;
};

export type ListingSuggestionProvider = {
  readonly providerName: string;
  suggestListing(input: ListingSuggestionInput): Promise<ListingSuggestionOutput>;
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
};

export type ModerationSummaryProvider = {
  readonly providerName: string;
  summarizeModerationCase(input: ModerationSummaryInput): Promise<ModerationSummaryOutput>;
};

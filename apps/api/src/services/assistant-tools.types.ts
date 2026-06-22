import type { z } from "zod";
import type { RagSearchResult } from "./rag.types.js";
import type { AssistantChildPersonalizationContext } from "./assistant-child-personalization.service.js";

export type AssistantToolContext = {
  childPersonalization?: AssistantChildPersonalizationContext | null;
  ragSearch?: (query: string, limit?: number) => Promise<RagSearchResult[]>;
  listingSearch?: (input: {
    categoryId?: string;
    city?: string;
    condition?: string;
    limit?: number;
    query: string;
  }) => Promise<AssistantListingSearchResult[]>;
  listingDetail?: (input: { listingId: string }) => Promise<AssistantListingDetailSummary | null>;
  sellerPublicSummary?: (input: { listingId?: string; profileId?: string }) => Promise<AssistantSellerPublicSummary | null>;
};

export type AssistantListingSearchResult = {
  listingId: string;
  title: string;
  category?: string;
  condition?: string;
  imageUrl?: string;
  price?: string;
  currency?: string;
  city?: string;
  href: string;
  status?: string;
};

export type AssistantListingDetailSummary = {
  listingId: string;
  title: string;
  descriptionPreview?: string;
  price?: string;
  currency?: string;
  category?: string;
  condition?: string;
  city?: string;
  imageCount: number;
  status?: string;
  href: string;
  safeSellerSummary?: {
    displayName?: string;
    city?: string;
  };
};

export type AssistantSellerPublicSummary = {
  displayName?: string;
  city?: string;
  activeListingCount?: number;
  memberSince?: string;
  publicTrustHints?: string[];
};

export type AssistantToolDefinition<Input, Output> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<Input>;
  outputSchema?: z.ZodType<Output>;
  readOnly: boolean;
  draftOnly?: boolean;
  requiresAuth?: boolean;
  riskLevel: "low" | "medium" | "high";
  category: "rag" | "listing" | "category" | "seller" | "draft" | "safety";
  returnsPrivateData: false;
  execute(context: AssistantToolContext, input: Input): Promise<Output>;
};

export type AssistantToolResult<T> = {
  ok: true;
  data: T;
} | {
  ok: false;
  code: "TOOL_UNAVAILABLE" | "INVALID_TOOL_INPUT";
  message: string;
};

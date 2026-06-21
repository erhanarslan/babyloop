import type { z } from "zod";
import type { RagSearchResult } from "./rag.types.js";

export type AssistantToolContext = {
  ragSearch?: (query: string, limit?: number) => Promise<RagSearchResult[]>;
  listingSearch?: (input: { query: string; city?: string; limit?: number }) => Promise<AssistantListingSearchResult[]>;
};

export type AssistantListingSearchResult = {
  id: string;
  title: string;
  price?: string;
  city?: string;
  href: string;
};

export type AssistantToolDefinition<Input, Output> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<Input>;
  readOnly: true;
  requiresAuth?: boolean;
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

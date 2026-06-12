import { z } from "zod";

export const adminConversationParamsSchema = z.object({
  conversationId: z.string().uuid()
});

export const adminConversationsQuerySchema = z.object({
  status: z.enum(["active"]).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(["latest_desc", "latest_asc", "newest", "oldest"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const adminConversationProfileSummarySchema = z.object({
  profileId: z.string().uuid(),
  displayName: z.string().min(1),
  safetyStatus: z.enum(["active", "restricted", "suspended"])
}).strict();

const adminConversationListingSummarySchema = z.object({
  listingId: z.string().uuid(),
  title: z.string().min(1),
  status: z.string().min(1)
}).strict();

const adminConversationMessagePreviewSchema = z.object({
  messageId: z.string().uuid(),
  senderProfileId: z.string().uuid(),
  bodyPreview: z.string(),
  isHidden: z.boolean(),
  createdAt: z.string().datetime()
}).strict();

export const adminConversationSummarySchema = z.object({
  conversationId: z.string().uuid(),
  status: z.string().min(1),
  participants: z.tuple([
    adminConversationProfileSummarySchema,
    adminConversationProfileSummarySchema
  ]),
  contextListing: adminConversationListingSummarySchema.nullable(),
  latestMessage: adminConversationMessagePreviewSchema.nullable(),
  messageCount: z.number().int().nonnegative(),
  reportedMessageCount: z.number().int().nonnegative(),
  openCaseCount: z.number().int().nonnegative(),
  enforcementCount: z.number().int().nonnegative(),
  lastMessageAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

const adminConversationMessageSummarySchema = z.object({
  messageId: z.string().uuid(),
  sender: adminConversationProfileSummarySchema,
  bodyPreview: z.string(),
  isHidden: z.boolean(),
  reportCount: z.number().int().nonnegative(),
  openCaseCount: z.number().int().nonnegative(),
  enforcementCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime()
}).strict();

const adminConversationCaseSummarySchema = z.object({
  caseId: z.string().uuid(),
  reportId: z.string().uuid().nullable(),
  targetType: z.literal("message"),
  targetId: z.string().uuid(),
  status: z.enum(["pending", "in_review", "resolved", "dismissed"]),
  priority: z.enum(["low", "normal", "high"]),
  reason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

const adminConversationEnforcementSummarySchema = z.object({
  actionId: z.string().uuid(),
  caseId: z.string().uuid().nullable(),
  messageId: z.string().uuid().nullable(),
  actionType: z.string().min(1),
  createdAt: z.string().datetime()
}).strict();

export const adminConversationDetailSchema = adminConversationSummarySchema.extend({
  messages: z.array(adminConversationMessageSummarySchema),
  relatedModerationCases: z.array(adminConversationCaseSummarySchema),
  enforcementHistory: z.array(adminConversationEnforcementSummarySchema)
}).strict();

export const adminConversationsResponseSchema = z.object({
  conversations: z.array(adminConversationSummarySchema)
}).strict();

export const adminConversationDetailResponseSchema = z.object({
  conversation: adminConversationDetailSchema
}).strict();

export type AdminConversationParams = z.infer<typeof adminConversationParamsSchema>;
export type AdminConversationsQuery = z.infer<typeof adminConversationsQuerySchema>;
export type AdminConversationSummaryResponse = z.infer<typeof adminConversationSummarySchema>;
export type AdminConversationDetailResponse = z.infer<typeof adminConversationDetailSchema>;

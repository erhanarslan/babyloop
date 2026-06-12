import { describe, expect, it } from "vitest";
import {
  adminConversationDetailResponseSchema,
  adminConversationParamsSchema,
  adminConversationsQuerySchema,
  adminConversationsResponseSchema
} from "../src/schemas/admin-conversations.schemas.js";

const safeConversationSummary = {
  conversationId: "00000000-0000-4000-8000-000000000001",
  status: "active",
  participants: [
    {
      profileId: "00000000-0000-4000-8000-000000000002",
      displayName: "Buyer Parent",
      safetyStatus: "active"
    },
    {
      profileId: "00000000-0000-4000-8000-000000000003",
      displayName: "Seller Parent",
      safetyStatus: "restricted"
    }
  ],
  contextListing: {
    listingId: "00000000-0000-4000-8000-000000000004",
    title: "Stroller",
    status: "active"
  },
  latestMessage: {
    messageId: "00000000-0000-4000-8000-000000000005",
    senderProfileId: "00000000-0000-4000-8000-000000000002",
    bodyPreview: "[redacted-contact] delivery question",
    isHidden: false,
    createdAt: "2026-06-12T12:00:00.000Z"
  },
  messageCount: 4,
  reportedMessageCount: 1,
  openCaseCount: 1,
  enforcementCount: 0,
  lastMessageAt: "2026-06-12T12:00:00.000Z",
  createdAt: "2026-06-12T11:00:00.000Z",
  updatedAt: "2026-06-12T12:00:00.000Z"
} as const;

describe("admin conversations schemas", () => {
  it("accepts safe conversation filters", () => {
    const parsed = adminConversationsQuerySchema.safeParse({
      status: "active",
      q: "Buyer",
      sort: "latest_desc",
      limit: "25"
    });

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.limit).toBe(25);
      expect(parsed.data.q).toBe("Buyer");
    }
  });

  it("rejects unsafe conversation filters", () => {
    expect(adminConversationsQuerySchema.safeParse({ status: "deleted" }).success).toBe(false);
    expect(adminConversationsQuerySchema.safeParse({ sort: "raw" }).success).toBe(false);
    expect(adminConversationsQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(adminConversationsQuerySchema.safeParse({ q: "" }).success).toBe(false);
  });

  it("accepts safe conversation params", () => {
    expect(
      adminConversationParamsSchema.safeParse({
        conversationId: "00000000-0000-4000-8000-000000000001"
      }).success
    ).toBe(true);

    expect(adminConversationParamsSchema.safeParse({ conversationId: "bad" }).success).toBe(false);
  });

  it("accepts safe conversation list response data", () => {
    const parsed = adminConversationsResponseSchema.safeParse({
      conversations: [safeConversationSummary]
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects identity and raw message fields in conversation list response data", () => {
    const parsed = adminConversationsResponseSchema.safeParse({
      conversations: [
        {
          ...safeConversationSummary,
          participants: [
            {
              profileId: "00000000-0000-4000-8000-000000000002",
              displayName: "Buyer Parent",
              safetyStatus: "active",
              email: "buyer@example.com"
            },
            {
              profileId: "00000000-0000-4000-8000-000000000003",
              displayName: "Seller Parent",
              safetyStatus: "active"
            }
          ],
          latestMessage: {
            ...safeConversationSummary.latestMessage,
            body: "Raw message body must not be returned."
          }
        }
      ]
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts safe conversation detail response data", () => {
    const parsed = adminConversationDetailResponseSchema.safeParse({
      conversation: {
        ...safeConversationSummary,
        messages: [
          {
            messageId: "00000000-0000-4000-8000-000000000005",
            sender: safeConversationSummary.participants[0],
            bodyPreview: "[redacted-contact] delivery question",
            isHidden: false,
            reportCount: 1,
            openCaseCount: 1,
            enforcementCount: 0,
            createdAt: "2026-06-12T12:00:00.000Z"
          }
        ],
        relatedModerationCases: [
          {
            caseId: "00000000-0000-4000-8000-000000000006",
            reportId: "00000000-0000-4000-8000-000000000007",
            targetType: "message",
            targetId: "00000000-0000-4000-8000-000000000005",
            status: "pending",
            priority: "high",
            reason: "harassment",
            createdAt: "2026-06-12T12:00:00.000Z",
            updatedAt: "2026-06-12T12:00:00.000Z"
          }
        ],
        enforcementHistory: [
          {
            actionId: "00000000-0000-4000-8000-000000000008",
            caseId: "00000000-0000-4000-8000-000000000006",
            messageId: "00000000-0000-4000-8000-000000000005",
            actionType: "message_hide",
            createdAt: "2026-06-12T12:00:00.000Z"
          }
        ]
      }
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects unsafe fields in conversation detail response data", () => {
    const parsed = adminConversationDetailResponseSchema.safeParse({
      conversation: {
        ...safeConversationSummary,
        messages: [
          {
            messageId: "00000000-0000-4000-8000-000000000005",
            sender: safeConversationSummary.participants[0],
            bodyPreview: "safe preview",
            body: "Raw body must not be returned.",
            reporterEmail: "reporter@example.com",
            reportCount: 1,
            openCaseCount: 1,
            enforcementCount: 0,
            isHidden: false,
            createdAt: "2026-06-12T12:00:00.000Z"
          }
        ],
        relatedModerationCases: [],
        enforcementHistory: []
      }
    });

    expect(parsed.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { sanitizeAdminModerationTimelineMetadata } from "../src/services/admin-moderation.service.js";

describe("admin moderation timeline metadata", () => {
  it("keeps only allowlisted safe metadata", () => {
    expect(
      sanitizeAdminModerationTimelineMetadata({
        requestedFields: ["reporter", "message"],
        grantedFields: ["message"],
        deniedFields: ["reporter"],
        targetType: "message",
        targetId: "30000000-0000-4000-8000-000000000001",
        denialReason: "field_not_available_for_case",
        actionType: "resolved",
        status: "resolved",
        messageBody: "raw message body",
        reporterEmail: "reporter@example.test",
        token: "secret-token",
        conversationParticipants: ["profile-a", "profile-b"],
        reason: "operator reason may contain private details"
      })
    ).toEqual({
      requestedFields: ["reporter", "message"],
      grantedFields: ["message"],
      deniedFields: ["reporter"],
      targetType: "message",
      targetId: "30000000-0000-4000-8000-000000000001",
      denialReason: "field_not_available_for_case",
      actionType: "resolved",
      status: "resolved"
    });
  });

  it("omits unsupported value shapes", () => {
    expect(
      sanitizeAdminModerationTimelineMetadata({
        requestedFields: ["message", 123],
        targetType: { value: "message" },
        status: "pending"
      })
    ).toEqual({
      status: "pending"
    });
  });
});

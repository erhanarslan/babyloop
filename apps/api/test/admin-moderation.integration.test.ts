import {
  conversationParticipants,
  conversations,
  events,
  listings,
  messages,
  moderationActions,
  moderationCases
} from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { authHeader, createUser } from "./helpers/auth.js";
import { resetTestDatabase } from "./helpers/db.js";
import { createListing } from "./helpers/fixtures.js";

let app!: TestApp;

beforeEach(async () => {
  await resetTestDatabase();
  app = await createTestApp();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await app.close();
});

describe("admin moderation API", () => {
  it("protects admin moderation routes from unauthenticated and non-admin users", async () => {
    const user = await createUser(app);

    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/v1/admin/moderation/cases"
    });

    const nonAdmin = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: "/api/v1/admin/moderation/cases"
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(nonAdmin.statusCode).toBe(403);
    expect(nonAdmin.json()).toMatchObject({
      ok: false,
      error: {
        code: "FORBIDDEN"
      }
    });
  });

  it("allows admins to list moderation cases created from listing reports", async () => {
    const admin = await createUser(app, {
      role: "admin",
      email: "admin-list-cases@babyloop.test"
    });
    const seller = await createUser(app);
    const reporter = await createUser(app);
    const listing = await createListing(app, seller.accessToken, {
      title: "Reported stroller"
    });

    const reportResponse = await app.inject({
      headers: authHeader(reporter.accessToken),
      method: "POST",
      url: `/api/v1/reports/listings/${listing.id}`,
      payload: {
        reason: "scam",
        details: "The listing looks suspicious."
      }
    });

    expect(reportResponse.statusCode).toBe(201);

    const listResponse = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "GET",
      url: "/api/v1/admin/moderation/cases"
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      ok: true,
      data: {
        cases: [
          expect.objectContaining({
            targetType: "listing",
            targetId: listing.id,
            status: "pending",
            priority: "normal",
            report: expect.objectContaining({
              reason: "scam",
              status: "pending",
              reporter: {
                redacted: true
              }
            }),
            targetPreview: expect.objectContaining({
              type: "listing",
              id: listing.id,
              title: "Reported stroller",
              status: "active"
            })
          })
        ]
      }
    });

    const serialized = JSON.stringify(listResponse.json());

    expect(serialized).not.toContain(reporter.user.email);
    expect(serialized).not.toContain(reporter.profile.id);
    expect(serialized).not.toContain(reporter.profile.displayName);
  });

  it("allows admins to read moderation case detail", async () => {
    const admin = await createUser(app, {
      role: "admin",
      email: "admin-detail-case@babyloop.test"
    });
    const seller = await createUser(app);
    const reporter = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    await app.inject({
      headers: authHeader(reporter.accessToken),
      method: "POST",
      url: `/api/v1/reports/listings/${listing.id}`,
      payload: {
        reason: "inappropriate"
      }
    });

    const [createdCase] = await app.db
      .select({
        id: moderationCases.id
      })
      .from(moderationCases)
      .where(eq(moderationCases.targetId, listing.id))
      .limit(1);

    if (!createdCase) {
      throw new Error("Moderation case setup failed.");
    }

    const detailResponse = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "GET",
      url: `/api/v1/admin/moderation/cases/${createdCase.id}`
    });

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      ok: true,
      data: {
        case: expect.objectContaining({
          id: createdCase.id,
          targetType: "listing",
          targetId: listing.id,
          status: "pending"
        }),
        actions: []
      }
    });
  });

  it("redacts reporter identity and raw message PII in admin moderation responses", async () => {
    const admin = await createUser(app, {
      role: "admin",
      email: "admin-message-redaction@babyloop.test"
    });
    const sender = await createUser(app);
    const recipient = await createUser(app);

    const [profileLowId, profileHighId] = [
      sender.profile.id,
      recipient.profile.id
    ].sort();

    const [conversation] = await app.db
      .insert(conversations)
      .values({
        profileLowId,
        profileHighId,
        createdByProfileId: sender.profile.id
      })
      .returning({
        id: conversations.id
      });

    if (!conversation) {
      throw new Error("Conversation setup failed.");
    }
    await app.db.insert(conversationParticipants).values([
  {
    conversationId: conversation.id,
    profileId: sender.profile.id
  },
  {
    conversationId: conversation.id,
    profileId: recipient.profile.id
  }
]);

    const rawMessageBody =
      "Bana +90 555 111 22 33 numarasından ulaş veya secret-parent@babyloop.test adresine yaz. ürün satılık mı";

    const [message] = await app.db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        senderProfileId: sender.profile.id,
        body: rawMessageBody
      })
      .returning({
        id: messages.id
      });

    if (!message) {
      throw new Error("Message setup failed.");
    }

    const [createdCase] = await app.db
      .insert(moderationCases)
      .values({
        targetType: "message",
        targetId: message.id,
        status: "pending",
        priority: "normal"
      })
      .returning({
        id: moderationCases.id
      });

    if (!createdCase) {
      throw new Error("Moderation case setup failed.");
    }

    const detailResponse = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "GET",
      url: `/api/v1/admin/moderation/cases/${createdCase.id}`
    });

    expect(detailResponse.statusCode).toBe(200);

    const body = detailResponse.json();
    const serialized = JSON.stringify(body);

    expect(body).toMatchObject({
      ok: true,
      data: {
        case: expect.objectContaining({
          id: createdCase.id,
          targetType: "message",
          targetId: message.id,
          targetPreview: expect.objectContaining({
            type: "message",
            id: message.id,
            bodyPreview: expect.stringContaining("[redacted-phone]")
          })
        })
      }
    });

    expect(serialized).toContain("[redacted-email]");
    expect(serialized).toContain("ürün satılık mı");
    expect(serialized).not.toContain("+90 555 111 22 33");
    expect(serialized).not.toContain("secret-parent@babyloop.test");
    expect(serialized).not.toContain(rawMessageBody);
    expect(serialized).not.toContain(conversation.id);
    expect(serialized).not.toContain(sender.profile.id);
    expect(serialized).not.toContain(sender.user.email);
  });

  it("validates sensitive access requests and rejects non-admin users", async () => {
    const admin = await createUser(app, {
      role: "admin",
      email: "admin-sensitive-validation@babyloop.test"
    });
    const nonAdmin = await createUser(app);
    const seller = await createUser(app);
    const reporter = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    await app.inject({
      headers: authHeader(reporter.accessToken),
      method: "POST",
      url: `/api/v1/reports/listings/${listing.id}`,
      payload: {
        reason: "scam"
      }
    });

    const [createdCase] = await app.db
      .select({
        id: moderationCases.id
      })
      .from(moderationCases)
      .where(eq(moderationCases.targetId, listing.id))
      .limit(1);

    if (!createdCase) {
      throw new Error("Moderation case setup failed.");
    }

    const missingReason = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${createdCase.id}/sensitive-access`,
      payload: {
        fields: ["reporter"]
      }
    });

    const shortReason = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${createdCase.id}/sensitive-access`,
      payload: {
        reason: "too short",
        fields: ["reporter"]
      }
    });

    const emptyFields = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${createdCase.id}/sensitive-access`,
      payload: {
        reason: "Review reporter identity for moderation triage.",
        fields: []
      }
    });

    const invalidFields = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${createdCase.id}/sensitive-access`,
      payload: {
        reason: "Review reporter identity for moderation triage.",
        fields: ["reporter", "conversation"]
      }
    });

    const nonAdminResponse = await app.inject({
      headers: authHeader(nonAdmin.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${createdCase.id}/sensitive-access`,
      payload: {
        reason: "Review reporter identity for moderation triage.",
        fields: ["reporter"]
      }
    });

    expect(missingReason.statusCode).toBe(400);
    expect(shortReason.statusCode).toBe(400);
    expect(emptyFields.statusCode).toBe(400);
    expect(invalidFields.statusCode).toBe(400);
    expect(nonAdminResponse.statusCode).toBe(403);
    expect(nonAdminResponse.json()).toMatchObject({
      ok: false,
      error: {
        code: "FORBIDDEN"
      }
    });

    const deniedAuditRows = await app.db
      .select({
        id: events.id,
        actorProfileId: events.actorProfileId,
        eventType: events.eventType,
        entityType: events.entityType,
        entityId: events.entityId,
        metadata: events.metadata
      })
      .from(events)
      .where(eq(events.entityId, createdCase.id));

    expect(deniedAuditRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorProfileId: admin.profile.id,
          eventType: "admin_sensitive_access_denied",
          entityType: "moderation_case",
          entityId: createdCase.id,
          metadata: expect.objectContaining({
            requestedFields: ["reporter"],
            deniedFields: ["reporter"],
            denialReason: "invalid_request_body"
          })
        }),
        expect.objectContaining({
          actorProfileId: nonAdmin.profile.id,
          eventType: "admin_sensitive_access_denied",
          entityType: "moderation_case",
          entityId: createdCase.id,
          metadata: expect.objectContaining({
            requestedFields: ["reporter"],
            deniedFields: ["reporter"],
            denialReason: "sensitive_access_forbidden"
          })
        })
      ])
    );
    expect(JSON.stringify(deniedAuditRows)).not.toContain(reporter.user.email);
  });

  it("audits safely denied sensitive access for missing cases and unsupported fields", async () => {
    const admin = await createUser(app, {
      role: "admin",
      email: "admin-sensitive-denied@babyloop.test"
    });
    const seller = await createUser(app);
    const reporter = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    await app.inject({
      headers: authHeader(reporter.accessToken),
      method: "POST",
      url: `/api/v1/reports/listings/${listing.id}`,
      payload: {
        reason: "scam"
      }
    });

    const [createdCase] = await app.db
      .select({
        id: moderationCases.id
      })
      .from(moderationCases)
      .where(eq(moderationCases.targetId, listing.id))
      .limit(1);

    if (!createdCase) {
      throw new Error("Moderation case setup failed.");
    }

    const unsupportedFieldResponse = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${createdCase.id}/sensitive-access`,
      payload: {
        reason: "Review whether raw message text is available.",
        fields: ["message"]
      }
    });

    expect(unsupportedFieldResponse.statusCode).toBe(200);
    expect(unsupportedFieldResponse.json()).toMatchObject({
      ok: true,
      data: {
        caseId: createdCase.id,
        grantedFields: [],
        sensitive: {},
        auditEventId: expect.any(String)
      }
    });

    const missingCaseId = "00000000-0000-4000-8000-000000000000";
    const missingCaseResponse = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${missingCaseId}/sensitive-access`,
      payload: {
        reason: "Review reporter identity for moderation triage.",
        fields: ["reporter"]
      }
    });

    expect(missingCaseResponse.statusCode).toBe(404);

    const unsupportedAuditRows = await app.db
      .select({
        id: events.id,
        actorProfileId: events.actorProfileId,
        eventType: events.eventType,
        entityType: events.entityType,
        entityId: events.entityId,
        metadata: events.metadata
      })
      .from(events)
      .where(eq(events.entityId, createdCase.id));

    expect(unsupportedAuditRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorProfileId: admin.profile.id,
          eventType: "admin_sensitive_access_denied",
          entityType: "moderation_case",
          entityId: createdCase.id,
          metadata: expect.objectContaining({
            requestedFields: ["message"],
            deniedFields: ["message"],
            denialReason: "field_not_available_for_case"
          })
        }),
        expect.objectContaining({
          actorProfileId: admin.profile.id,
          eventType: "admin_sensitive_access_granted",
          entityType: "moderation_case",
          entityId: createdCase.id,
          metadata: expect.objectContaining({
            requestedFields: ["message"],
            grantedFields: [],
            deniedFields: ["message"]
          })
        })
      ])
    );

    const missingCaseAuditRows = await app.db
      .select({
        actorProfileId: events.actorProfileId,
        eventType: events.eventType,
        entityType: events.entityType,
        entityId: events.entityId,
        metadata: events.metadata
      })
      .from(events)
      .where(eq(events.entityId, missingCaseId));

    expect(missingCaseAuditRows).toEqual([
      expect.objectContaining({
        actorProfileId: admin.profile.id,
        eventType: "admin_sensitive_access_denied",
        entityType: "moderation_case",
        entityId: missingCaseId,
        metadata: expect.objectContaining({
          requestedFields: ["reporter"],
          deniedFields: ["reporter"],
          denialReason: "moderation_case_not_found"
        })
      })
    ]);
  });

  it("returns only requested sensitive fields and writes an audit event", async () => {
    const admin = await createUser(app, {
      role: "admin",
      email: "admin-sensitive-access@babyloop.test"
    });
    const sender = await createUser(app, {
      email: "sender-sensitive@babyloop.test",
      displayName: "Sensitive Sender"
    });
    const recipient = await createUser(app, {
      email: "recipient-sensitive@babyloop.test",
      displayName: "Sensitive Recipient"
    });

    const [profileLowId, profileHighId] = [
      sender.profile.id,
      recipient.profile.id
    ].sort();

    const [conversation] = await app.db
      .insert(conversations)
      .values({
        profileLowId,
        profileHighId,
        createdByProfileId: sender.profile.id
      })
      .returning({
        id: conversations.id
      });

    if (!conversation) {
      throw new Error("Conversation setup failed.");
    }
    await app.db.insert(conversationParticipants).values([
      {
        conversationId: conversation.id,
        profileId: sender.profile.id
      },
      {
        conversationId: conversation.id,
        profileId: recipient.profile.id
      }
    ]);

    const rawMessageBody = "Raw sensitive message body for moderator review.";

    const [message] = await app.db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        senderProfileId: sender.profile.id,
        body: rawMessageBody
      })
      .returning({
        id: messages.id
      });

    if (!message) {
      throw new Error("Message setup failed.");
    }

    const reportResponse = await app.inject({
      headers: authHeader(recipient.accessToken),
      method: "POST",
      url: `/api/v1/reports/messages/${message.id}`,
      payload: {
        reason: "harassment",
        details: "This message needs moderator review."
      }
    });

    
    expect(reportResponse.statusCode).toBe(201);

    const [createdCase] = await app.db
      .select({
        id: moderationCases.id
      })
      .from(moderationCases)
      .where(eq(moderationCases.targetId, message.id))
      .limit(1);

    if (!createdCase) {
      throw new Error("Moderation case setup failed.");
    }

    const messageAccess = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${createdCase.id}/sensitive-access`,
      payload: {
        reason: "Review raw message text for safety moderation.",
        fields: ["message"]
      }
    });

    expect(messageAccess.statusCode).toBe(200);
    expect(messageAccess.json()).toMatchObject({
      ok: true,
      data: {
        caseId: createdCase.id,
        grantedFields: ["message"],
        sensitive: {
          message: {
            id: message.id,
            body: rawMessageBody,
            senderProfileId: sender.profile.id
          }
        },
        auditEventId: expect.any(String)
      }
    });
    expect(messageAccess.json().data.sensitive.reporter).toBeUndefined();
    expect(JSON.stringify(messageAccess.json())).not.toContain(conversation.id);

    const reporterAccess = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${createdCase.id}/sensitive-access`,
      payload: {
        reason: "Review reporter identity for abuse triage.",
        fields: ["reporter"]
      }
    });

    expect(reporterAccess.statusCode).toBe(200);
    expect(reporterAccess.json()).toMatchObject({
      ok: true,
      data: {
        caseId: createdCase.id,
        grantedFields: ["reporter"],
        sensitive: {
          reporter: {
            profileId: recipient.profile.id,
            displayName: recipient.profile.displayName,
            email: recipient.user.email
          }
        },
        auditEventId: expect.any(String)
      }
    });
    expect(reporterAccess.json().data.sensitive.message).toBeUndefined();

    const auditRows = await app.db
      .select({
        id: events.id,
        actorProfileId: events.actorProfileId,
        eventType: events.eventType,
        entityType: events.entityType,
        entityId: events.entityId,
        metadata: events.metadata
      })
      .from(events)
      .where(eq(events.entityId, createdCase.id));

    expect(auditRows).toHaveLength(2);
    expect(auditRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: messageAccess.json().data.auditEventId,
          actorProfileId: admin.profile.id,
          eventType: "admin_sensitive_access_granted",
          entityType: "moderation_case",
          entityId: createdCase.id,
          metadata: expect.objectContaining({
            requestedFields: ["message"],
            grantedFields: ["message"],
            reason: "Review raw message text for safety moderation."
          })
        }),
        expect.objectContaining({
          id: reporterAccess.json().data.auditEventId,
          actorProfileId: admin.profile.id,
          eventType: "admin_sensitive_access_granted",
          entityType: "moderation_case",
          entityId: createdCase.id,
          metadata: expect.objectContaining({
            requestedFields: ["reporter"],
            grantedFields: ["reporter"],
            reason: "Review reporter identity for abuse triage."
          })
        })
      ])
    );
  });

  it("allows admins to update case status and creates a moderation action", async () => {
    const admin = await createUser(app, {
      role: "admin",
      email: "admin-update-case@babyloop.test"
    });
    const seller = await createUser(app);
    const reporter = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    await app.inject({
      headers: authHeader(reporter.accessToken),
      method: "POST",
      url: `/api/v1/reports/listings/${listing.id}`,
      payload: {
        reason: "safety"
      }
    });

    const [createdCase] = await app.db
      .select({
        id: moderationCases.id
      })
      .from(moderationCases)
      .where(eq(moderationCases.targetId, listing.id))
      .limit(1);

    if (!createdCase) {
      throw new Error("Moderation case setup failed.");
    }

    const response = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "PATCH",
      url: `/api/v1/admin/moderation/cases/${createdCase.id}/status`,
      payload: {
        status: "in_review",
        note: "Review started by admin."
      }
    });

    const [updatedCase] = await app.db
      .select({
        status: moderationCases.status
      })
      .from(moderationCases)
      .where(eq(moderationCases.id, createdCase.id))
      .limit(1);

    const actionRows = await app.db
      .select({
        id: moderationActions.id,
        actionType: moderationActions.actionType,
        note: moderationActions.note,
        actorProfileId: moderationActions.actorProfileId
      })
      .from(moderationActions)
      .where(eq(moderationActions.moderationCaseId, createdCase.id));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        caseId: createdCase.id
      }
    });
    expect(updatedCase?.status).toBe("in_review");
    expect(actionRows).toHaveLength(1);
    expect(actionRows[0]).toMatchObject({
      actionType: "in_review",
      note: "Review started by admin.",
      actorProfileId: admin.profile.id
    });
  });
});

import { conversations, messages, moderationActions, moderationCases } from "@babyloop/database/schema";
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
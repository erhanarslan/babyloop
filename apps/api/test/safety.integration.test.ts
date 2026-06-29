import {
  blockedProfiles,
  moderationCases,
  reports,
  userSafetyEvents
} from "@babyloop/database/schema";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { authHeader, createUser } from "./helpers/auth.js";
import { resetTestDatabase } from "./helpers/db.js";
import { createConversation, createListing } from "./helpers/fixtures.js";

let app!: TestApp;

beforeEach(async () => {
  await resetTestDatabase();
  app = await createTestApp();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await app.close();
});

describe("trust and safety API", () => {
  it("allows an authenticated user to report another user's listing and creates a moderation case and safety event", async () => {
    const seller = await createUser(app);
    const reporter = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    const response = await app.inject({
      headers: authHeader(reporter.accessToken),
      method: "POST",
      url: `/api/v1/reports/listings/${listing.id}`,
      payload: {
        reason: "scam",
        details: "The pickup terms look suspicious."
      }
    });
    const reportRows = await app.db
      .select({ id: reports.id })
      .from(reports)
      .where(and(eq(reports.reporterProfileId, reporter.profile.id), eq(reports.targetId, listing.id)));
    const caseRows = await app.db
      .select({ id: moderationCases.id })
      .from(moderationCases)
      .where(eq(moderationCases.targetId, listing.id));
    const safetyEventRows = await app.db
      .select({ id: userSafetyEvents.id })
      .from(userSafetyEvents)
      .where(and(eq(userSafetyEvents.profileId, reporter.profile.id), eq(userSafetyEvents.eventType, "report_created")));

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        report: {
          targetType: "listing",
          targetId: listing.id,
          status: "pending",
          created: true
        }
      }
    });
    expect(reportRows).toHaveLength(1);
    expect(caseRows).toHaveLength(1);
    expect(safetyEventRows).toHaveLength(1);
  });

  it("keeps duplicate reports by the same reporter and target idempotent", async () => {
    const seller = await createUser(app);
    const reporter = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    const first = await reportListing(reporter.accessToken, listing.id);
    const second = await reportListing(reporter.accessToken, listing.id);
    const reportRows = await app.db.select({ id: reports.id }).from(reports);
    const caseRows = await app.db.select({ id: moderationCases.id }).from(moderationCases);
    const safetyEventRows = await app.db.select({ id: userSafetyEvents.id }).from(userSafetyEvents);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().data.report.id).toBe(first.json().data.report.id);
    expect(second.json().data.report.created).toBe(false);
    expect(reportRows).toHaveLength(1);
    expect(caseRows).toHaveLength(1);
    expect(safetyEventRows).toHaveLength(1);
  });

  it("validates report auth, targets, self-report policy, and safe plaintext details", async () => {
    const seller = await createUser(app);
    const reporter = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    const unauthenticated = await app.inject({
      method: "POST",
      url: `/api/v1/reports/listings/${listing.id}`,
      payload: {
        reason: "safety"
      }
    });
    const missingTarget = await app.inject({
      headers: authHeader(reporter.accessToken),
      method: "POST",
      url: "/api/v1/reports/listings/99999999-9999-4999-8999-999999999999",
      payload: {
        reason: "safety"
      }
    });
    const ownProfile = await app.inject({
      headers: authHeader(reporter.accessToken),
      method: "POST",
      url: `/api/v1/reports/profiles/${reporter.profile.id}`,
      payload: {
        reason: "harassment"
      }
    });
    const ownListing = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: `/api/v1/reports/listings/${listing.id}`,
      payload: {
        reason: "other"
      }
    });
    const invalidDetails = await app.inject({
      headers: authHeader(reporter.accessToken),
      method: "POST",
      url: `/api/v1/reports/listings/${listing.id}`,
      payload: {
        reason: "safety",
        details: "<script>alert(1)</script>"
      }
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(missingTarget.statusCode).toBe(404);
    expect(ownProfile.statusCode).toBe(400);
    expect(ownProfile.json().error.code).toBe("CANNOT_REPORT_SELF");
    expect(ownListing.statusCode).toBe(403);
    expect(invalidDetails.statusCode).toBe(400);
  });

  it("allows users to report profiles and accessible conversation messages", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const outsider = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(app, buyer.accessToken, listing.id)).json().data.conversation;
    const message = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "Hello, is this available?"
      }
    });
    const messageId = message.json().data.message.id;

    const profileReport = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/reports/profiles/${seller.profile.id}`,
      payload: {
        reason: "harassment"
      }
    });
    const participantMessageReport = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: `/api/v1/reports/messages/${messageId}`,
      payload: {
        reason: "inappropriate"
      }
    });
    const outsiderMessageReport = await app.inject({
      headers: authHeader(outsider.accessToken),
      method: "POST",
      url: `/api/v1/reports/messages/${messageId}`,
      payload: {
        reason: "inappropriate"
      }
    });

    expect(profileReport.statusCode).toBe(201);
    expect(profileReport.json().data.report).toMatchObject({
      targetType: "profile",
      targetId: seller.profile.id
    });
    expect(participantMessageReport.statusCode).toBe(201);
    expect(participantMessageReport.json().data.report).toMatchObject({
      targetType: "message",
      targetId: messageId
    });
    expect(outsiderMessageReport.statusCode).toBe(403);
  });

  it("allows idempotent block and unblock and lists blocked profiles without private user data", async () => {
    const blocker = await createUser(app);
    const blocked = await createUser(app, {
      displayName: "Blocked User",
      email: "blocked-user@babyloop.test"
    });

    const firstBlock = await blockProfileRequest(blocker.accessToken, blocked.profile.id);
    const secondBlock = await blockProfileRequest(blocker.accessToken, blocked.profile.id);
    const list = await app.inject({
      headers: authHeader(blocker.accessToken),
      method: "GET",
      url: "/api/v1/profiles/blocked"
    });
    const firstUnblock = await unblockProfileRequest(blocker.accessToken, blocked.profile.id);
    const secondUnblock = await unblockProfileRequest(blocker.accessToken, blocked.profile.id);
    const blockRowsAfterUnblock = await app.db.select({ id: blockedProfiles.id }).from(blockedProfiles);

    expect(firstBlock.statusCode).toBe(201);
    expect(secondBlock.statusCode).toBe(200);
    expect(secondBlock.json().data.created).toBe(false);
    expect(list.statusCode).toBe(200);
    expect(list.json().data.blockedProfiles).toEqual([
      expect.objectContaining({
        id: blocked.profile.id,
        displayName: "Blocked User"
      })
    ]);
    expect(JSON.stringify(list.json())).not.toContain("blocked-user@babyloop.test");
    expect(firstUnblock.statusCode).toBe(200);
    expect(firstUnblock.json().data.removed).toBe(true);
    expect(secondUnblock.statusCode).toBe(200);
    expect(secondUnblock.json().data.removed).toBe(false);
    expect(blockRowsAfterUnblock).toHaveLength(0);
  });

  it("rejects self-blocking", async () => {
    const user = await createUser(app);

    const response = await blockProfileRequest(user.accessToken, user.profile.id);

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("CANNOT_BLOCK_SELF");
  });

  it("validates block auth, unblock auth, block list auth, and missing target handling", async () => {
    const blocker = await createUser(app);
    const blocked = await createUser(app);
    const missingProfileId = "99999999-9999-4999-8999-999999999999";

    const unauthenticatedList = await app.inject({
      method: "GET",
      url: "/api/v1/profiles/blocked"
    });
    const unauthenticatedBlock = await app.inject({
      method: "POST",
      url: `/api/v1/profiles/${blocked.profile.id}/block`
    });
    const unauthenticatedUnblock = await app.inject({
      method: "DELETE",
      url: `/api/v1/profiles/${blocked.profile.id}/block`
    });
    const missingTargetBlock = await app.inject({
      headers: authHeader(blocker.accessToken),
      method: "POST",
      url: `/api/v1/profiles/${missingProfileId}/block`
    });
    const missingTargetUnblock = await app.inject({
      headers: authHeader(blocker.accessToken),
      method: "DELETE",
      url: `/api/v1/profiles/${missingProfileId}/block`
    });

    expect(unauthenticatedList.statusCode).toBe(401);
    expect(unauthenticatedBlock.statusCode).toBe(401);
    expect(unauthenticatedUnblock.statusCode).toBe(401);
    expect(missingTargetBlock.statusCode).toBe(404);
    expect(missingTargetUnblock.statusCode).toBe(404);
  });

  it("blocks new conversation starts and message sends in either direction", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listingBeforeBlock = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(app, buyer.accessToken, listingBeforeBlock.id)).json().data.conversation;

    await blockProfileRequest(seller.accessToken, buyer.profile.id);

    const listingAfterBlock = await createListing(app, seller.accessToken);
    const startAfterBlock = await createConversation(app, buyer.accessToken, listingAfterBlock.id);
    const buyerSendAfterBlock = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "Can you still see this?"
      }
    });
    const sellerSendAfterBlock = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "I should also be blocked from sending."
      }
    });

    expect(startAfterBlock.statusCode).toBe(403);
    expect(startAfterBlock.json().error.code).toBe("PROFILE_BLOCKED");
    expect(buyerSendAfterBlock.statusCode).toBe(403);
    expect(buyerSendAfterBlock.json().error.code).toBe("PROFILE_BLOCKED");
    expect(sellerSendAfterBlock.statusCode).toBe(403);
    expect(sellerSendAfterBlock.json().error.code).toBe("PROFILE_BLOCKED");
  });
});

function reportListing(token: string, listingId: string) {
  return app.inject({
    headers: authHeader(token),
    method: "POST",
    url: `/api/v1/reports/listings/${listingId}`,
    payload: {
      reason: "safety"
    }
  });
}

function blockProfileRequest(token: string, profileId: string) {
  return app.inject({
    headers: authHeader(token),
    method: "POST",
    url: `/api/v1/profiles/${profileId}/block`
  });
}

function unblockProfileRequest(token: string, profileId: string) {
  return app.inject({
    headers: authHeader(token),
    method: "DELETE",
    url: `/api/v1/profiles/${profileId}/block`
  });
}

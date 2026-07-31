import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listingImages,
  listings,
  profileTrustSnapshots,
  users
} from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME } from "../src/utils/backoffice-access-token-cookie.js";
import {
  BACKOFFICE_CSRF_COOKIE_NAME,
  BACKOFFICE_CSRF_HEADER_NAME
} from "../src/utils/backoffice-csrf.js";
import { authHeader, createUser } from "./helpers/auth.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";
import { createListing } from "./helpers/fixtures.js";

let app!: TestApp;

const VALID_UUID = "99999999-9999-4999-8999-999999999999";
const PROFILE_SENTINEL = "2099-12-31T23:59:58.000Z";
const LISTING_REVIEW_SENTINEL = "VIEWER_INTERNAL_REVIEW_SENTINEL";
const LISTING_AI_SENTINEL = "VIEWER_INTERNAL_AI_SENTINEL";

const FORBIDDEN_VIEWER_PROFILE_KEYS = [
  "trustSnapshot",
  "trustScore",
  "riskScore",
  "riskLevel",
  "openCaseCount",
  "totalCaseCount",
  "recentReportCount",
  "recentEnforcementCount",
  "sensitiveAccessCount",
  "aiSummaryCount",
  "lastReportAt",
  "lastEnforcementAt",
  "stats",
  "relatedModerationCases",
  "enforcementHistory",
];

const FORBIDDEN_VIEWER_LISTING_KEYS = [
  "publicationReviewReason",
  "moderation",
  "auditTrail",
  "relatedModerationCases",
  "actionEligibility",
  "authenticity",
  "providerName",
  "modelName",
  "promptVersion",
  "flags",
  "reviewedByProfileId",
  "reviewedAt",
];

describe("backoffice route permission matrix", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  it("allows a viewer safe reads while rejecting listing and profile mutations", async () => {
    const viewer = await createUser(app, {
      email: "viewer-read-only@babyloop.test",
      role: "backoffice_viewer",
    });

    for (const url of [
      "/api/v1/admin/dashboard/summary",
      "/api/v1/admin/listings",
      "/api/v1/admin/profiles",
    ]) {
      const response = await app.inject({
        headers: authHeader(viewer.accessToken),
        method: "GET",
        url,
      });
      expect(response.statusCode, url).toBe(200);
      expectResponseToBeSecretSafe(response.body);
    }

    const listingMutation = await app.inject({
      headers: authHeader(viewer.accessToken),
      method: "POST",
      url: `/api/v1/admin/listings/${VALID_UUID}/actions`,
      payload: { action: "archive", reason: "viewer must not mutate listings" },
    });
    const profileMutation = await app.inject({
      headers: authHeader(viewer.accessToken),
      method: "POST",
      url: `/api/v1/admin/profiles/${VALID_UUID}/enforcement`,
      payload: { action: "profile_restrict", reason: "viewer must not mutate profiles" },
    });
    const audit = await app.inject({
      headers: authHeader(viewer.accessToken),
      method: "GET",
      url: "/api/v1/admin/audit/events",
    });
    const publicationSettings = await app.inject({
      headers: authHeader(viewer.accessToken),
      method: "GET",
      url: "/api/v1/admin/listings/publication-settings",
    });

    expect(listingMutation.statusCode).toBe(403);
    expect(profileMutation.statusCode).toBe(403);
    expect(audit.statusCode).toBe(403);
    expect(publicationSettings.statusCode).toBe(403);
  });

  it("projects viewer profile list responses to basic safe identity fields", async () => {
    const { viewer, subject } = await setupViewerProfileProjection();
    const response = await app.inject({
      headers: authHeader(viewer.accessToken),
      method: "GET",
      url: `/api/v1/admin/profiles?q=${encodeURIComponent(subject.profile.id)}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.profiles).toContainEqual(expect.objectContaining({
      profileId: subject.profile.id,
      displayName: subject.profile.displayName,
      listingCount: 0,
    }));
    expectViewerResponseToExclude(response.body, FORBIDDEN_VIEWER_PROFILE_KEYS, [PROFILE_SENTINEL]);
  });

  it("projects viewer profile detail responses to basic safe identity fields", async () => {
    const { viewer, subject } = await setupViewerProfileProjection();
    const response = await app.inject({
      headers: authHeader(viewer.accessToken),
      method: "GET",
      url: `/api/v1/admin/profiles/${subject.profile.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.profile).toEqual({
      profileId: subject.profile.id,
      displayName: subject.profile.displayName,
      locationCity: subject.profile.locationCity,
      createdAt: expect.any(String),
      listingCount: 0,
    });
    expectViewerResponseToExclude(response.body, FORBIDDEN_VIEWER_PROFILE_KEYS, [PROFILE_SENTINEL]);
  });

  it("projects viewer listing list responses without review or AI metadata", async () => {
    const { listing, viewer } = await setupViewerListingProjection();
    const response = await app.inject({
      headers: authHeader(viewer.accessToken),
      method: "GET",
      url: `/api/v1/admin/listings?q=${encodeURIComponent(listing.id)}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.listings).toContainEqual(expect.objectContaining({
      id: listing.id,
      title: listing.title,
      primaryImage: expect.objectContaining({ url: expect.any(String) }),
    }));
    expectViewerResponseToExclude(response.body, FORBIDDEN_VIEWER_LISTING_KEYS, [
      LISTING_REVIEW_SENTINEL,
      LISTING_AI_SENTINEL,
    ]);
  });

  it("projects viewer listing detail responses without review or AI metadata", async () => {
    const { listing, viewer } = await setupViewerListingProjection();
    const response = await app.inject({
      headers: authHeader(viewer.accessToken),
      method: "GET",
      url: `/api/v1/admin/listings/${listing.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.listing).toEqual(expect.objectContaining({
      id: listing.id,
      images: [expect.objectContaining({ url: expect.any(String) })],
    }));
    expectViewerResponseToExclude(response.body, FORBIDDEN_VIEWER_LISTING_KEYS, [
      LISTING_REVIEW_SENTINEL,
      LISTING_AI_SENTINEL,
    ]);
  });

  it("keeps a viewer account usable in public auth and product routes", async () => {
    const email = "viewer-public-account@babyloop.test";
    const viewer = await createUser(app, { email, role: "backoffice_viewer" });
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: "Password123!" },
    });

    expect(login.statusCode).toBe(200);
    const accessToken = login.json().data.accessToken as string;
    const me = await app.inject({
      headers: authHeader(accessToken),
      method: "GET",
      url: "/api/v1/auth/me",
    });
    const publicRead = await app.inject({
      headers: authHeader(accessToken),
      method: "GET",
      url: "/api/v1/notification-preferences",
    });
    const publicMutation = await app.inject({
      headers: authHeader(accessToken),
      method: "PATCH",
      url: "/api/v1/notification-preferences",
      payload: {
        source: "messages",
        channel: "in_app",
        enabled: false,
      },
    });
    const backofficeMutation = await app.inject({
      headers: authHeader(accessToken),
      method: "POST",
      url: `/api/v1/admin/listings/${VALID_UUID}/actions`,
      payload: { action: "archive", reason: "viewer remains read-only in backoffice" },
    });

    expect(me.statusCode).toBe(200);
    expect(me.json().data.user.role).toBe("backoffice_viewer");
    expect(publicRead.statusCode).toBe(200);
    expect(publicMutation.statusCode).toBe(200);
    expect(backofficeMutation.statusCode).toBe(403);
    expect(viewer.user.role).toBe("backoffice_viewer");
  });

  it("keeps a normal-user preview principal read-only, sanitized, and separate from public auth", async () => {
    const previewUser = await createUser(app, {
      email: "normal-preview@babyloop.test"
    });
    const previewHeaders = await loginPreviewUser("normal-preview@babyloop.test");
    const profileSubject = await createUser(app, {
      displayName: "Preview Safe Profile",
      email: "preview-profile-subject@babyloop.test"
    });
    const listingSeller = await createUser(app, {
      email: "preview-listing-seller@babyloop.test"
    });
    const listing = await createListing(app, listingSeller.accessToken, {
      title: "Preview Safe Listing"
    });

    await app.db.insert(profileTrustSnapshots).values({
      profileId: profileSubject.profile.id,
      trustScore: 2,
      riskScore: 98,
      riskLevel: "critical",
      openCaseCount: 21,
      totalCaseCount: 22,
      recentReportCount: 23,
      recentEnforcementCount: 24,
      sensitiveAccessCount: 25,
      aiSummaryCount: 26,
      lastReportAt: new Date(PROFILE_SENTINEL),
      lastEnforcementAt: new Date(PROFILE_SENTINEL)
    });
    await app.db
      .update(listings)
      .set({ publicationReviewReason: LISTING_REVIEW_SENTINEL })
      .where(eq(listings.id, listing.id));
    await app.db
      .update(listingImages)
      .set({
        authenticityProvider: LISTING_AI_SENTINEL,
        authenticityModel: `${LISTING_AI_SENTINEL}_MODEL`,
        authenticityPromptVersion: `${LISTING_AI_SENTINEL}_PROMPT`,
        authenticityFlags: { internal: LISTING_AI_SENTINEL },
        reviewedByProfileId: previewUser.profile.id
      })
      .where(eq(listingImages.listingId, listing.id));

    const allowedReads = await Promise.all([
      app.inject({
        headers: previewHeaders,
        method: "GET",
        url: `/api/v1/admin/listings?q=${encodeURIComponent(listing.id)}`
      }),
      app.inject({
        headers: previewHeaders,
        method: "GET",
        url: `/api/v1/admin/listings/${listing.id}`
      }),
      app.inject({
        headers: previewHeaders,
        method: "GET",
        url: `/api/v1/admin/profiles?q=${encodeURIComponent(profileSubject.profile.id)}`
      }),
      app.inject({
        headers: previewHeaders,
        method: "GET",
        url: `/api/v1/admin/profiles/${profileSubject.profile.id}`
      })
    ]);

    for (const response of allowedReads) {
      expect(response.statusCode).toBe(200);
      expectResponseToBeSecretSafe(response.body);
    }
    for (const response of allowedReads.slice(0, 2)) {
      expectViewerResponseToExclude(response.body, FORBIDDEN_VIEWER_LISTING_KEYS, [
        LISTING_REVIEW_SENTINEL,
        LISTING_AI_SENTINEL
      ]);
    }
    for (const response of allowedReads.slice(2)) {
      expectViewerResponseToExclude(response.body, FORBIDDEN_VIEWER_PROFILE_KEYS, [
        PROFILE_SENTINEL
      ]);
    }

    for (const url of [
      "/api/v1/admin/dashboard/summary",
      "/api/v1/admin/analytics/overview",
      "/api/v1/admin/audit/events",
      "/api/v1/admin/ai-ops/summary",
      "/api/v1/admin/moderation/cases"
    ]) {
      const response = await app.inject({
        headers: previewHeaders,
        method: "GET",
        url
      });
      expect(response.statusCode, url).toBe(403);
      expectForbiddenBody(response.body);
    }

    for (const request of [
      {
        url: `/api/v1/admin/listings/${listing.id}/actions`,
        payload: { action: "archive", reason: "preview cannot mutate listings" }
      },
      {
        url: `/api/v1/admin/profiles/${profileSubject.profile.id}/enforcement`,
        payload: { action: "profile_restrict", reason: "preview cannot mutate profiles" }
      },
      {
        url: `/api/v1/admin/moderation/cases/${VALID_UUID}/actions`,
        payload: { actionType: "review_started", note: "preview cannot moderate" }
      }
    ]) {
      const response = await app.inject({
        headers: previewHeaders,
        method: "POST",
        url: request.url,
        payload: request.payload
      });
      expect(response.statusCode, request.url).toBe(403);
      expectForbiddenBody(response.body);
    }

    const publicTokenAttempt = await app.inject({
      headers: authHeader(previewUser.accessToken),
      method: "GET",
      url: "/api/v1/admin/listings"
    });
    const [storedUser] = await app.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, previewUser.user.id))
      .limit(1);

    expect(publicTokenAttempt.statusCode).toBe(403);
    expect(storedUser?.role).toBe("user");
  });

  it("rejects client-supplied backoffice roles and access modes", async () => {
    await createUser(app, { email: "preview-spoof@babyloop.test" });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/backoffice/login",
      payload: {
        email: "preview-spoof@babyloop.test",
        password: "Password123!",
        role: "admin",
        accessMode: "staff"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (app) {
      await app.close();
    }
  });

  it("keeps listing review routes behind listing_review permission", async () => {
    const regularUser = await createUser(app, {
      email: "regular-listing-review@babyloop.test",
      role: "user"
    });
    const support = await createUser(app, {
      email: "support-listing-review@babyloop.test",
      role: "support"
    });
    const moderator = await createUser(app, {
      email: "moderator-listing-review@babyloop.test",
      role: "moderator"
    });
    const admin = await createUser(app, {
      email: "admin-listing-review@babyloop.test",
      role: "admin"
    });

    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/v1/admin/listings"
    });
    const userResponse = await app.inject({
      headers: authHeader(regularUser.accessToken),
      method: "GET",
      url: "/api/v1/admin/listings"
    });
    const supportResponse = await app.inject({
      headers: authHeader(support.accessToken),
      method: "GET",
      url: "/api/v1/admin/listings"
    });
    const moderatorResponse = await app.inject({
      headers: authHeader(moderator.accessToken),
      method: "GET",
      url: "/api/v1/admin/listings"
    });
    const adminResponse = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "GET",
      url: "/api/v1/admin/listings"
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(userResponse.statusCode).toBe(403);
    expect(supportResponse.statusCode).toBe(403);
    expect(moderatorResponse.statusCode).toBe(200);
    expect(adminResponse.statusCode).toBe(200);

    expectForbiddenBody(userResponse.body);
    expectForbiddenBody(supportResponse.body);
  });

  it("keeps audit routes admin-only through audit_view permission", async () => {
    const regularUser = await createUser(app, {
      email: "regular-audit-view@babyloop.test",
      role: "user"
    });
    const support = await createUser(app, {
      email: "support-audit-view@babyloop.test",
      role: "support"
    });
    const moderator = await createUser(app, {
      email: "moderator-audit-view@babyloop.test",
      role: "moderator"
    });
    const admin = await createUser(app, {
      email: "admin-audit-view@babyloop.test",
      role: "admin"
    });

    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/v1/admin/audit/events"
    });
    const userResponse = await app.inject({
      headers: authHeader(regularUser.accessToken),
      method: "GET",
      url: "/api/v1/admin/audit/events"
    });
    const supportResponse = await app.inject({
      headers: authHeader(support.accessToken),
      method: "GET",
      url: "/api/v1/admin/audit/events"
    });
    const moderatorResponse = await app.inject({
      headers: authHeader(moderator.accessToken),
      method: "GET",
      url: "/api/v1/admin/audit/events"
    });
    const adminResponse = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "GET",
      url: "/api/v1/admin/audit/events"
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(userResponse.statusCode).toBe(403);
    expect(supportResponse.statusCode).toBe(403);
    expect(moderatorResponse.statusCode).toBe(403);
    expect(adminResponse.statusCode).toBe(200);

    expectForbiddenBody(userResponse.body);
    expectForbiddenBody(supportResponse.body);
    expectForbiddenBody(moderatorResponse.body);
  });

  it("allows support and moderator read-only trust ops routes while blocking regular users", async () => {
    const regularUser = await createUser(app, {
      email: "regular-view-trust@babyloop.test",
      role: "user"
    });
    const support = await createUser(app, {
      email: "support-view-trust@babyloop.test",
      role: "support"
    });
    const moderator = await createUser(app, {
      email: "moderator-view-trust@babyloop.test",
      role: "moderator"
    });
    const admin = await createUser(app, {
      email: "admin-view-trust@babyloop.test",
      role: "admin"
    });

    for (const url of [
      "/api/v1/admin/profiles",
      "/api/v1/admin/conversations",
      "/api/v1/admin/moderation/cases"
    ]) {
      const unauthenticated = await app.inject({
        method: "GET",
        url
      });
      const userResponse = await app.inject({
        headers: authHeader(regularUser.accessToken),
        method: "GET",
        url
      });
      const supportResponse = await app.inject({
        headers: authHeader(support.accessToken),
        method: "GET",
        url
      });
      const moderatorResponse = await app.inject({
        headers: authHeader(moderator.accessToken),
        method: "GET",
        url
      });
      const adminResponse = await app.inject({
        headers: authHeader(admin.accessToken),
        method: "GET",
        url
      });

      expect(unauthenticated.statusCode, `${url} unauthenticated`).toBe(401);
      expect(userResponse.statusCode, `${url} regular user`).toBe(403);
      expect(supportResponse.statusCode, `${url} support`).toBe(200);
      expect(moderatorResponse.statusCode, `${url} moderator`).toBe(200);
      expect(adminResponse.statusCode, `${url} admin`).toBe(200);

      expectForbiddenBody(userResponse.body);
      expectResponseToBeSecretSafe(supportResponse.body);
      expectResponseToBeSecretSafe(moderatorResponse.body);
      expectResponseToBeSecretSafe(adminResponse.body);
    }
  });

  it("keeps enforcement routes unavailable to support users but available to moderators and admins", async () => {
    const support = await createUser(app, {
      email: "support-enforcement@babyloop.test",
      role: "support"
    });
    const moderator = await createUser(app, {
      email: "moderator-enforcement@babyloop.test",
      role: "moderator"
    });
    const admin = await createUser(app, {
      email: "admin-enforcement@babyloop.test",
      role: "admin"
    });

    const supportModerationAction = await app.inject({
      headers: authHeader(support.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${VALID_UUID}/actions`,
      payload: {
        actionType: "review_started",
        note: "Support should not be able to enforce moderation actions."
      }
    });
    const supportProfileEnforcement = await app.inject({
      headers: authHeader(support.accessToken),
      method: "POST",
      url: `/api/v1/admin/profiles/${VALID_UUID}/enforcement`,
      payload: {
        action: "profile_restrict",
        reason: "Support should not be able to enforce profile actions."
      }
    });
    const moderatorModerationAction = await app.inject({
      headers: authHeader(moderator.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${VALID_UUID}/actions`,
      payload: {
        actionType: "review_started",
        note: "Moderator may pass the route guard before not-found handling."
      }
    });
    const moderatorProfileEnforcement = await app.inject({
      headers: authHeader(moderator.accessToken),
      method: "POST",
      url: `/api/v1/admin/profiles/${VALID_UUID}/enforcement`,
      payload: {
        action: "profile_restrict",
        reason: "Moderator may pass profile enforcement guard before not-found handling."
      }
    });
    const adminModerationAction = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${VALID_UUID}/actions`,
      payload: {
        actionType: "review_started",
        note: "Admin may pass the route guard before not-found handling."
      }
    });
    const adminProfileEnforcement = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: `/api/v1/admin/profiles/${VALID_UUID}/enforcement`,
      payload: {
        action: "profile_restrict",
        reason: "Admin may pass profile enforcement guard before not-found handling."
      }
    });

    expect(supportModerationAction.statusCode).toBe(403);
    expect(supportProfileEnforcement.statusCode).toBe(403);
    expect(moderatorModerationAction.statusCode).toBe(404);
    expect(moderatorProfileEnforcement.statusCode).toBe(404);
    expect(adminModerationAction.statusCode).toBe(404);
    expect(adminProfileEnforcement.statusCode).toBe(404);

    expectForbiddenBody(supportModerationAction.body);
    expectForbiddenBody(supportProfileEnforcement.body);
  });

  it("keeps sensitive access unavailable to moderator and support roles", async () => {
    const support = await createUser(app, {
      email: "support-sensitive-access@babyloop.test",
      role: "support"
    });
    const moderator = await createUser(app, {
      email: "moderator-sensitive-access@babyloop.test",
      role: "moderator"
    });
    const admin = await createUser(app, {
      email: "admin-sensitive-access-route@babyloop.test",
      role: "admin"
    });

    const payload = {
      reason: "Review reporter identity for moderation triage.",
      fields: ["reporter"]
    };

    const supportResponse = await app.inject({
      headers: authHeader(support.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${VALID_UUID}/sensitive-access`,
      payload
    });
    const moderatorResponse = await app.inject({
      headers: authHeader(moderator.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${VALID_UUID}/sensitive-access`,
      payload
    });
    const adminResponse = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${VALID_UUID}/sensitive-access`,
      payload
    });

    expect(supportResponse.statusCode).toBe(403);
    expect(moderatorResponse.statusCode).toBe(403);
    expect(adminResponse.statusCode).toBe(404);

    expectForbiddenBody(supportResponse.body);
    expectForbiddenBody(moderatorResponse.body);
  });

  it("keeps AI ops unavailable to support and moderator roles through ai_ops_view permission", async () => {
    const support = await createUser(app, {
      email: "support-ai-ops@babyloop.test",
      role: "support"
    });
    const moderator = await createUser(app, {
      email: "moderator-ai-ops@babyloop.test",
      role: "moderator"
    });
    const admin = await createUser(app, {
      email: "admin-ai-ops-route@babyloop.test",
      role: "admin"
    });

    for (const url of ["/api/v1/admin/ai-ops/summary", "/api/v1/admin/ai-ops/runs"]) {
      const supportResponse = await app.inject({
        headers: authHeader(support.accessToken),
        method: "GET",
        url
      });
      const moderatorResponse = await app.inject({
        headers: authHeader(moderator.accessToken),
        method: "GET",
        url
      });
      const adminResponse = await app.inject({
        headers: authHeader(admin.accessToken),
        method: "GET",
        url
      });

      expect(supportResponse.statusCode, `${url} support`).toBe(403);
      expect(moderatorResponse.statusCode, `${url} moderator`).toBe(403);
      expect(adminResponse.statusCode, `${url} admin`).toBe(200);

      expectForbiddenBody(supportResponse.body);
      expectForbiddenBody(moderatorResponse.body);
      expectResponseToBeSecretSafe(adminResponse.body);
    }
  });
});

function expectForbiddenBody(body: string): void {
  expect(body).toContain('"ok":false');
  expect(body).toContain('"code":"FORBIDDEN"');
  expectResponseToBeSecretSafe(body);
}

function expectResponseToBeSecretSafe(body: string): void {
  for (const forbidden of [
    "passwordHash",
    "password_hash",
    "accessToken",
    "refreshToken",
    "babyloop_refresh_token",
    "SMTP_PASS",
    "RESEND_API_KEY",
    "AWS_SECRET_ACCESS_KEY",
    "rawMessageBody",
    "messageBody",
    "reporterEmail"
  ]) {
    expect(body).not.toContain(forbidden);
  }
}

async function setupViewerProfileProjection() {
  const viewer = await createUser(app, {
    email: "viewer-profile-projection@babyloop.test",
    role: "backoffice_viewer",
  });
  const subject = await createUser(app, {
    displayName: "Viewer Safe Profile Subject",
    email: "viewer-profile-subject@babyloop.test",
  });

  await app.db.insert(profileTrustSnapshots).values({
    profileId: subject.profile.id,
    trustScore: 3,
    riskScore: 97,
    riskLevel: "critical",
    openCaseCount: 11,
    totalCaseCount: 22,
    recentReportCount: 13,
    recentEnforcementCount: 14,
    sensitiveAccessCount: 15,
    aiSummaryCount: 16,
    lastReportAt: new Date(PROFILE_SENTINEL),
    lastEnforcementAt: new Date(PROFILE_SENTINEL),
  });

  return { subject, viewer };
}

async function setupViewerListingProjection() {
  const viewer = await createUser(app, {
    email: "viewer-listing-projection@babyloop.test",
    role: "backoffice_viewer",
  });
  const seller = await createUser(app, {
    email: "viewer-listing-seller@babyloop.test",
  });
  const listing = await createListing(app, seller.accessToken, {
    title: "Viewer Safe Listing",
  });

  await app.db
    .update(listings)
    .set({ publicationReviewReason: LISTING_REVIEW_SENTINEL })
    .where(eq(listings.id, listing.id));
  await app.db
    .update(listingImages)
    .set({
      authenticityProvider: LISTING_AI_SENTINEL,
      authenticityModel: `${LISTING_AI_SENTINEL}_MODEL`,
      authenticityPromptVersion: `${LISTING_AI_SENTINEL}_PROMPT`,
      authenticityFlags: { internal: LISTING_AI_SENTINEL },
      reviewedByProfileId: viewer.profile.id,
    })
    .where(eq(listingImages.listingId, listing.id));

  return { listing, viewer };
}

function expectViewerResponseToExclude(
  body: string,
  forbiddenKeys: string[],
  sentinelValues: string[],
): void {
  const keys = collectJsonKeys(JSON.parse(body));

  for (const forbiddenKey of forbiddenKeys) {
    expect(keys).not.toContain(forbiddenKey);
  }
  for (const sentinelValue of sentinelValues) {
    expect(body).not.toContain(sentinelValue);
  }
}

function collectJsonKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectJsonKeys);
  }
  if (value === null || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, item]) => [key, ...collectJsonKeys(item)]);
}

async function loginPreviewUser(email: string): Promise<{
  cookie: string;
  [BACKOFFICE_CSRF_HEADER_NAME]: string;
}> {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/backoffice/login",
    payload: {
      email,
      password: "Password123!"
    }
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().data).toMatchObject({
    accessMode: "preview",
    user: { role: "user" }
  });

  const setCookie = response.headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const accessCookie = cookies.find((cookie) =>
    cookie?.startsWith(`${BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME}=`)
  );
  const csrfCookie = cookies.find((cookie) =>
    cookie?.startsWith(`${BACKOFFICE_CSRF_COOKIE_NAME}=`)
  );

  expect(accessCookie).toBeDefined();
  expect(csrfCookie).toBeDefined();
  const csrfCookiePair = csrfCookie!.split(";")[0]!;
  const csrfToken = decodeURIComponent(csrfCookiePair.split("=")[1]!);

  return {
    cookie: `${accessCookie!.split(";")[0]!}; ${csrfCookiePair}`,
    [BACKOFFICE_CSRF_HEADER_NAME]: csrfToken
  };
}

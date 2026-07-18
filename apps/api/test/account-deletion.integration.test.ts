import { randomUUID } from "node:crypto";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  accountDeletionStorageCleanupJobs,
  analyticsEvents,
  analyticsSessions,
  authAccounts,
  cartItems,
  childProfiles,
  conversations,
  events,
  favorites,
  listingImages,
  listings,
  messages,
  notificationPreferences,
  notificationPushTokens,
  notifications,
  profiles,
  reports,
  savedSearches,
  sessions,
  users
} from "@babyloop/database/schema";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  processAccountDeletionStorageCleanupJobs
} from "../src/services/account-deletion.service.js";
import type { TestApp } from "./helpers/app.js";
import { createTestApp } from "./helpers/app.js";
import { authHeader, createUser } from "./helpers/auth.js";
import { resetTestDatabase } from "./helpers/db.js";
import {
  getSetCookieHeaders,
  toCookieHeader
} from "./helpers/cookies.js";
import { createRecordingEmailDeliveryService } from "./helpers/email.js";
import {
  createCategory,
  createConversation,
  createListing
} from "./helpers/fixtures.js";

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

describe("account deletion API", () => {
  let app: TestApp;
  let uploadRoot: string;
  let emailDelivery: ReturnType<typeof createRecordingEmailDeliveryService>;

  beforeEach(async () => {
    await resetTestDatabase();
    uploadRoot = await mkdirTemp("babyloop-account-deletion-");
    emailDelivery = createRecordingEmailDeliveryService();
    app = await createTestApp({
      emailDelivery,
      uploadRoot
    });
  });

  afterEach(async () => {
    await app.close();
    await rm(uploadRoot, {
      force: true,
      recursive: true
    });
  });

  it("requires the current password for password accounts and rejects a wrong password", async () => {
    const user = await createUser(app);

    const missingPassword = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/auth/account-deletion/request",
      payload: {}
    });

    const wrongPassword = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/auth/account-deletion/request",
      payload: {
        currentPassword: "WrongPassword123!"
      }
    });

    expect(missingPassword.statusCode).toBe(400);
    expect(missingPassword.json().error.code).toBe("CURRENT_PASSWORD_REQUIRED");
    expect(wrongPassword.statusCode).toBe(401);
    expect(wrongPassword.json().error.code).toBe("INVALID_CURRENT_PASSWORD");
    expect(emailDelivery.accountDeletionOtpEmails).toHaveLength(0);
  });

  it("requires CSRF protection for cookie-authenticated deletion requests", async () => {
    const user = await createUser(app);
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: user.user.email,
        password: "Password123!",
        clientType: "mobile"
      }
    });
    const cookieHeader = getSetCookieHeaders(login)
      .map(toCookieHeader)
      .join("; ");

    const response = await app.inject({
      headers: {
        cookie: cookieHeader
      },
      method: "POST",
      url: "/api/v1/auth/account-deletion/request",
      payload: {
        currentPassword: "Password123!"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe(
      "PUBLIC_CSRF_TOKEN_REQUIRED"
    );
    expect(emailDelivery.accountDeletionOtpEmails).toHaveLength(0);
  });

  it("allows a Google-only account to request deletion without a password", async () => {
    const user = await createUser(app);

    await app.db
      .delete(authAccounts)
      .where(eq(authAccounts.userId, user.user.id));

    await app.db.insert(authAccounts).values({
      userId: user.user.id,
      provider: "google",
      providerAccountId: "google-account-deletion-subject",
      email: user.user.email,
      emailVerifiedAt: new Date()
    });

    const response = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/auth/account-deletion/request",
      payload: {}
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      passwordRequired: false,
      requested: true,
      devOtpCode: expect.stringMatching(/^\d{6}$/)
    });
    expect(emailDelivery.accountDeletionOtpEmails).toHaveLength(1);
    expect(emailDelivery.accountDeletionOtpEmails[0]).toMatchObject({
      recipientEmail: user.user.email,
      code: response.json().data.devOtpCode
    });
  });

  it("rejects invalid confirmation data and accepts the valid one-time code", async () => {
    const user = await createUser(app);
    const request = await requestDeletion(app, user.accessToken);

    const invalidPhrase = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/auth/account-deletion/confirm",
      payload: {
        challengeId: request.challengeId,
        code: request.devOtpCode,
        confirmation: "SİL"
      }
    });

    const invalidCode = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/auth/account-deletion/confirm",
      payload: {
        challengeId: request.challengeId,
        code: "000000",
        confirmation: "HESABIMI SİL"
      }
    });

    const confirmed = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/auth/account-deletion/confirm",
      payload: {
        challengeId: request.challengeId,
        code: request.devOtpCode,
        confirmation: "HESABIMI SİL"
      }
    });

    expect(invalidPhrase.statusCode).toBe(400);
    expect(invalidCode.statusCode).toBe(400);
    expect(invalidCode.json().error.code).toBe(
      "ACCOUNT_DELETION_CHALLENGE_INVALID"
    );
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().data).toMatchObject({
      accountDeleted: true,
      profileId: user.profile.id
    });
    expect(
      getSetCookieHeaders(confirmed).filter((header) =>
        /babyloop_(refresh|public_access|public_csrf)_token=/u.test(header)
      )
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Max-Age=0")
      ])
    );

    const oldAccess = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: "/api/v1/auth/me"
    });

    expect(oldAccess.statusCode).toBe(401);
  });

  it("anonymizes marketplace history, deletes private data, revokes sessions, and cleans listing storage", async () => {
    const seller = await createUser(app, {
      displayName: "Deletion Seller",
      email: "account-deletion-seller@example.test"
    });
    const buyer = await createUser(app, {
      displayName: "Deletion Buyer",
      email: "account-deletion-buyer@example.test"
    });
    const category = await createCategory(app.db, {
      name: "Account deletion category",
      slug: "account-deletion-category"
    });
    const listing = await createListing(app, seller.accessToken, {
      categoryId: category.id,
      title: "Account deletion listing",
      withApprovedImage: false
    });
    const filename = `${randomUUID()}.png`;
    const imageUrl = `/api/v1/uploads/listings/${listing.id}/${filename}`;
    const imagePath = path.join(
      uploadRoot,
      "listings",
      listing.id,
      filename
    );
    const now = new Date();

    await mkdir(path.dirname(imagePath), { recursive: true });
    await writeFile(imagePath, Buffer.from("account-deletion-image"));

    await app.db.transaction(async (tx) => {
      await tx.insert(listingImages).values({
        listingId: listing.id,
        reviewStatus: "approved",
        sortOrder: 0,
        url: imageUrl
      });

      await tx
        .update(listings)
        .set({
          status: "active",
          publicationState: "published",
          publishedAt: now
        })
        .where(eq(listings.id, listing.id));
    });

    const conversationResponse = await createConversation(
      app,
      buyer.accessToken,
      listing.id
    );

    expect([200, 201]).toContain(conversationResponse.statusCode);

    const conversationId =
      conversationResponse.json().data.conversation.id as string;

    const messageResponse = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversationId}/messages`,
      payload: {
        body: "Bu mesaj anonim pazaryeri geçmişinde kalmalıdır."
      }
    });

    expect(messageResponse.statusCode).toBe(201);

    await seedPrivateData(app, {
      listingId: listing.id,
      profileId: seller.profile.id,
      userId: seller.user.id,
      otherProfileId: buyer.profile.id
    });

    const request = await requestDeletion(app, seller.accessToken);
    const confirm = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/auth/account-deletion/confirm",
      payload: {
        challengeId: request.challengeId,
        code: request.devOtpCode,
        confirmation: "HESABIMI SİL"
      }
    });

    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().data.storageCleanup).toMatchObject({
      completedCount: 1,
      failedCount: 0,
      pendingCount: 0
    });

    const [deletedUser, tombstoneProfile, archivedListing] =
      await Promise.all([
        app.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, seller.user.id)),
        app.db
          .select({
            userId: profiles.userId,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
            locationCity: profiles.locationCity
          })
          .from(profiles)
          .where(eq(profiles.id, seller.profile.id)),
        app.db
          .select({
            status: listings.status,
            publicationState: listings.publicationState,
            publishedAt: listings.publishedAt,
            publicationReviewReason: listings.publicationReviewReason
          })
          .from(listings)
          .where(eq(listings.id, listing.id))
      ]);

    expect(deletedUser).toHaveLength(0);
    expect(tombstoneProfile[0]).toEqual({
      userId: null,
      displayName: "Silinmiş kullanıcı",
      avatarUrl: null,
      locationCity: null
    });
    expect(archivedListing[0]).toMatchObject({
      status: "archived",
      publicationState: "changes_requested",
      publishedAt: null,
      publicationReviewReason: "account_deleted"
    });

    expect(
      await app.db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, seller.user.id))
    ).toHaveLength(0);
    expect(
      await app.db
        .select({ id: childProfiles.id })
        .from(childProfiles)
        .where(eq(childProfiles.profileId, seller.profile.id))
    ).toHaveLength(0);
    expect(
      await app.db
        .select({ id: favorites.id })
        .from(favorites)
        .where(eq(favorites.profileId, seller.profile.id))
    ).toHaveLength(0);
    expect(
      await app.db
        .select({ id: cartItems.id })
        .from(cartItems)
        .where(eq(cartItems.buyerProfileId, seller.profile.id))
    ).toHaveLength(0);
    expect(
      await app.db
        .select({ id: savedSearches.id })
        .from(savedSearches)
        .where(eq(savedSearches.profileId, seller.profile.id))
    ).toHaveLength(0);
    expect(
      await app.db
        .select({ id: notifications.id })
        .from(notifications)
        .where(eq(notifications.recipientProfileId, seller.profile.id))
    ).toHaveLength(0);
    expect(
      await app.db
        .select({ id: notificationPushTokens.id })
        .from(notificationPushTokens)
        .where(eq(notificationPushTokens.profileId, seller.profile.id))
    ).toHaveLength(0);
    expect(
      await app.db
        .select({ id: listingImages.id })
        .from(listingImages)
        .where(eq(listingImages.listingId, listing.id))
    ).toHaveLength(0);

    await expect(stat(imagePath)).rejects.toMatchObject({
      code: "ENOENT"
    });

    const cleanupJobs = await app.db
      .select({
        status: accountDeletionStorageCleanupJobs.status,
        attemptCount: accountDeletionStorageCleanupJobs.attemptCount,
        url: accountDeletionStorageCleanupJobs.url
      })
      .from(accountDeletionStorageCleanupJobs)
      .where(eq(accountDeletionStorageCleanupJobs.profileId, seller.profile.id));

    expect(cleanupJobs).toEqual([
      {
        status: "completed",
        attemptCount: 1,
        url: imageUrl
      }
    ]);

    const [preservedConversation] = await app.db
      .select({
        status: conversations.status
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    const preservedMessages = await app.db
      .select({ body: messages.body })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));

    expect(preservedConversation?.status).toBe("closed");
    expect(preservedMessages).toHaveLength(1);
    expect(preservedMessages[0]?.body).toContain("anonim pazaryeri");

    const [scrubbedReport] = await app.db
      .select({ details: reports.details })
      .from(reports)
      .where(eq(reports.reporterProfileId, seller.profile.id));
    const [anonymousAnalytics] = await app.db
      .select({
        userId: analyticsEvents.userId,
        profileId: analyticsEvents.profileId
      })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.eventId, "account-deletion-event"));
    const [accountDeletedEvent] = await app.db
      .select({
        actorProfileId: events.actorProfileId,
        eventType: events.eventType
      })
      .from(events)
      .where(
        and(
          eq(events.entityId, seller.profile.id),
          eq(events.eventType, "account_deleted")
        )
      );

    expect(scrubbedReport?.details).toBeNull();
    expect(anonymousAnalytics).toEqual({
      userId: null,
      profileId: null
    });
    expect(accountDeletedEvent).toEqual({
      actorProfileId: null,
      eventType: "account_deleted"
    });
  });

  it("keeps failed storage cleanup jobs retryable without persisting raw errors", async () => {
    const user = await createUser(app);
    const category = await createCategory(app.db);
    const listing = await createListing(app, user.accessToken, {
      categoryId: category.id,
      withApprovedImage: false
    });
    const batchId = randomUUID();

    const [job] = await app.db
      .insert(accountDeletionStorageCleanupJobs)
      .values({
        batchId,
        profileId: user.profile.id,
        listingId: listing.id,
        url: `/api/v1/uploads/listings/${listing.id}/${randomUUID()}.png`
      })
      .returning({ id: accountDeletionStorageCleanupJobs.id });

    expect(job).toBeTruthy();

    const failed = await processAccountDeletionStorageCleanupJobs(app, {
      batchId,
      uploadRoot,
      deleteImage: async () => {
        const error = new Error(
          "secret storage path /private/example must not be persisted"
        ) as Error & { code: string };
        error.code = "EDELETE";
        throw error;
      }
    });

    const [failedJob] = await app.db
      .select({
        status: accountDeletionStorageCleanupJobs.status,
        attemptCount: accountDeletionStorageCleanupJobs.attemptCount,
        lastErrorCode: accountDeletionStorageCleanupJobs.lastErrorCode,
        lastErrorMessageRedacted:
          accountDeletionStorageCleanupJobs.lastErrorMessageRedacted
      })
      .from(accountDeletionStorageCleanupJobs)
      .where(eq(accountDeletionStorageCleanupJobs.id, job!.id));

    expect(failed).toEqual({
      completedCount: 0,
      failedCount: 1,
      pendingCount: 1
    });
    expect(failedJob).toEqual({
      status: "failed",
      attemptCount: 1,
      lastErrorCode: "EDELETE",
      lastErrorMessageRedacted:
        "Storage cleanup failed. The retry worker will try again."
    });
    expect(JSON.stringify(failedJob)).not.toContain("/private/example");

    const completed = await processAccountDeletionStorageCleanupJobs(app, {
      batchId,
      uploadRoot,
      deleteImage: async () => {}
    });

    const [completedJob] = await app.db
      .select({
        status: accountDeletionStorageCleanupJobs.status,
        attemptCount: accountDeletionStorageCleanupJobs.attemptCount
      })
      .from(accountDeletionStorageCleanupJobs)
      .where(eq(accountDeletionStorageCleanupJobs.id, job!.id));

    expect(completed).toEqual({
      completedCount: 1,
      failedCount: 0,
      pendingCount: 0
    });
    expect(completedJob).toEqual({
      status: "completed",
      attemptCount: 2
    });
  });

  it("blocks backoffice roles from deleting themselves through the public flow", async () => {
    const admin = await createUser(app, {
      role: "admin"
    });

    const response = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: "/api/v1/auth/account-deletion/request",
      payload: {
        currentPassword: "Password123!"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe(
      "ACCOUNT_DELETION_FORBIDDEN"
    );
    expect(emailDelivery.accountDeletionOtpEmails).toHaveLength(0);
  });
});

async function requestDeletion(
  app: TestApp,
  accessToken: string
): Promise<{
  challengeId: string;
  devOtpCode: string;
}> {
  const response = await app.inject({
    headers: authHeader(accessToken),
    method: "POST",
    url: "/api/v1/auth/account-deletion/request",
    payload: {
      currentPassword: "Password123!"
    }
  });

  if (response.statusCode !== 200) {
    throw new Error(
      `Account deletion request setup failed: ${response.statusCode} ${response.body}`
    );
  }

  return response.json<
    ApiSuccess<{
      challengeId: string;
      devOtpCode: string;
    }>
  >().data;
}

async function seedPrivateData(
  app: TestApp,
  input: {
    listingId: string;
    otherProfileId: string;
    profileId: string;
    userId: string;
  }
): Promise<void> {
  const now = new Date();

  await app.db.insert(childProfiles).values({
    profileId: input.profileId,
    label: "Silinecek çocuk profili",
    ageBand: "toddler_12_24"
  });
  await app.db.insert(favorites).values({
    profileId: input.profileId,
    listingId: input.listingId
  });
  await app.db.insert(cartItems).values({
    buyerProfileId: input.profileId,
    listingId: input.listingId
  });
  await app.db.insert(savedSearches).values({
    profileId: input.profileId,
    name: "Silinecek kayıtlı arama",
    queryText: "bebek arabası"
  });
  await app.db.insert(notifications).values({
    recipientProfileId: input.profileId,
    type: "system",
    title: "Silinecek bildirim",
    body: "Bu bildirim hesapla birlikte silinmelidir."
  });
  await app.db.insert(notificationPreferences).values({
    profileId: input.profileId,
    source: "security",
    channel: "email",
    enabled: true
  });
  await app.db.insert(notificationPushTokens).values({
    profileId: input.profileId,
    tokenHash: "a".repeat(64),
    platform: "expo"
  });
  await app.db.insert(reports).values({
    reporterProfileId: input.profileId,
    targetType: "profile",
    targetId: input.otherProfileId,
    reason: "other",
    details: "Silinecek kişisel report ayrıntısı."
  });
  await app.db.insert(analyticsEvents).values({
    eventId: "account-deletion-event",
    eventName: "account_deletion_fixture",
    eventVersion: 1,
    occurredAt: now,
    platform: "web",
    sessionId: "account-deletion-session",
    anonymousIdHash: "anonymous-hash",
    userId: input.userId,
    profileId: input.profileId,
    properties: {
      safe: true
    }
  });
  await app.db.insert(analyticsSessions).values({
    sessionId: "account-deletion-session",
    anonymousIdHash: "anonymous-hash",
    userId: input.userId,
    platform: "web",
    startedAt: now,
    lastSeenAt: now
  });
}

async function mkdirTemp(prefix: string): Promise<string> {
  const directory = path.join(tmpdir(), `${prefix}${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  return directory;
}

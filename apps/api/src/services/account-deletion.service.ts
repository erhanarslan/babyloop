import { randomUUID } from "node:crypto";
import {
  accountDeletionStorageCleanupJobs,
  analyticsEvents,
  analyticsSessions,
  authAccounts,
  blockedProfiles,
  cartItems,
  childProfiles,
  conversationParticipants,
  conversations,
  events,
  favorites,
  listingImages,
  listings,
  marketplacePublicationSettings,
  messages,
  mfaOtpChallenges,
  moderationActions,
  notificationDeliveryLogs,
  notificationPreferenceAuditEvents,
  notificationPreferences,
  notificationPushTokens,
  notifications,
  profiles,
  profileTrustSnapshots,
  reports,
  savedSearches,
  shortLinks,
  userSafetyEvents,
  users
} from "@babyloop/database/schema";
import {
  realtimeProfileRoom,
  type ApiFailure,
  type ApiResponse,
  type ApiSuccess
} from "@babyloop/shared";
import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql
} from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import type {
  AccountDeletionConfirmBody,
  AccountDeletionRequestBody
} from "../schemas/auth.schemas.js";
import {
  createMfaOtpCode,
  createMfaOtpExpiresAt,
  hashMfaOtpCode,
  MFA_OTP_TTL_SECONDS
} from "../utils/mfa-otp.js";
import { verifyPassword } from "../utils/password.js";
import type { EmailDeliveryService } from "./email-delivery.service.js";
import { deleteStoredListingImage } from "./image-storage.service.js";
import { isBackofficeRole } from "./admin-context.service.js";

const ACCOUNT_DELETION_OTP_PURPOSE = "account_deletion";
const ACCOUNT_DELETION_TOMBSTONE_NAME = "Silinmiş kullanıcı";
const ACCOUNT_DELETION_CLEANUP_WORKER_INTERVAL_MS = 60_000;
const ACCOUNT_DELETION_CLEANUP_MAX_ATTEMPTS = 10;
const ACCOUNT_DELETION_CLEANUP_PROCESSING_STALE_MS = 5 * 60_000;

export type AccountDeletionRequestResponse = ApiSuccess<{
  challengeId: string;
  expiresAt: string;
  passwordRequired: boolean;
  requested: true;
  devOtpCode?: string;
}>;

export type AccountDeletionConfirmResponse = ApiResponse<{
  accountDeleted: true;
  profileId: string;
  storageCleanup: AccountDeletionStorageCleanupSummary;
}>;

export type AccountDeletionStorageCleanupSummary = {
  completedCount: number;
  failedCount: number;
  pendingCount: number;
};

export type AccountDeletionRequestResult =
  | {
      status: "requested";
      response: AccountDeletionRequestResponse;
      devOtpCode: string;
    }
  | {
      status: "forbidden";
      response: ApiFailure;
    }
  | {
      status: "not_found";
      response: ApiFailure;
    }
  | {
      status: "password_required";
      response: ApiFailure;
    }
  | {
      status: "invalid_password";
      response: ApiFailure;
    };

export type AccountDeletionConfirmResult =
  | {
      status: "deleted";
      response: AccountDeletionConfirmResponse;
    }
  | {
      status: "forbidden";
      response: ApiFailure;
    }
  | {
      status: "invalid_challenge";
      response: ApiFailure;
    }
  | {
      status: "not_found";
      response: ApiFailure;
    };

type DeleteStoredImage = (input: {
  uploadRoot: string;
  url: string;
}) => Promise<void>;

export async function requestAccountDeletion(
  app: FastifyInstance,
  currentUser: CurrentUser,
  body: AccountDeletionRequestBody,
  options: {
    emailDelivery: EmailDeliveryService;
  }
): Promise<AccountDeletionRequestResult> {
  if (isBackofficeRole(currentUser.role)) {
    return {
      status: "forbidden",
      response: accountDeletionForbidden()
    };
  }

  const [identity] = await app.db
    .select({
      displayName: profiles.displayName,
      email: users.email,
      passwordHash: users.passwordHash
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        eq(users.id, currentUser.userId),
        eq(profiles.id, currentUser.profile.id)
      )
    )
    .limit(1);

  if (!identity) {
    return {
      status: "not_found",
      response: accountDeletionIdentityNotFound()
    };
  }

  const [passwordAccount] = await app.db
    .select({ id: authAccounts.id })
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.userId, currentUser.userId),
        eq(authAccounts.provider, "password")
      )
    )
    .limit(1);

  const passwordRequired = Boolean(passwordAccount);

  if (passwordRequired && !body.currentPassword) {
    return {
      status: "password_required",
      response: currentPasswordRequired()
    };
  }

  if (
    passwordRequired &&
    body.currentPassword &&
    !(await verifyPassword(body.currentPassword, identity.passwordHash))
  ) {
    return {
      status: "invalid_password",
      response: invalidCurrentPassword()
    };
  }

  const now = new Date();
  const code = createMfaOtpCode();
  const expiresAt = createMfaOtpExpiresAt(now);

  const challenge = await app.db.transaction(async (tx) => {
    await tx.execute(
      sql`select ${users.id} from ${users} where ${users.id} = ${currentUser.userId} for update`
    );

    await tx
      .update(mfaOtpChallenges)
      .set({ consumedAt: now })
      .where(
        and(
          eq(mfaOtpChallenges.userId, currentUser.userId),
          eq(mfaOtpChallenges.purpose, ACCOUNT_DELETION_OTP_PURPOSE),
          isNull(mfaOtpChallenges.consumedAt)
        )
      );

    const [created] = await tx
      .insert(mfaOtpChallenges)
      .values({
        userId: currentUser.userId,
        codeHash: hashMfaOtpCode(code),
        purpose: ACCOUNT_DELETION_OTP_PURPOSE,
        expiresAt
      })
      .returning({
        id: mfaOtpChallenges.id,
        expiresAt: mfaOtpChallenges.expiresAt
      });

    if (!created) {
      throw new Error("Account deletion challenge creation failed.");
    }

    return created;
  });

  try {
    await options.emailDelivery.sendAccountDeletionOtpEmail({
      recipientEmail: identity.email,
      code,
      displayName: identity.displayName,
      expiresInSeconds: MFA_OTP_TTL_SECONDS
    });
  } catch (error) {
    await app.db
      .update(mfaOtpChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(mfaOtpChallenges.id, challenge.id));

    throw error;
  }

  return {
    status: "requested",
    devOtpCode: code,
    response: {
      ok: true,
      data: {
        challengeId: challenge.id,
        expiresAt: challenge.expiresAt.toISOString(),
        passwordRequired,
        requested: true
      }
    }
  };
}

export async function confirmAccountDeletion(
  app: FastifyInstance,
  currentUser: CurrentUser,
  body: AccountDeletionConfirmBody,
  options: {
    uploadRoot: string;
  }
): Promise<AccountDeletionConfirmResult> {
  if (isBackofficeRole(currentUser.role)) {
    return {
      status: "forbidden",
      response: accountDeletionForbidden()
    };
  }

  const now = new Date();
  const cleanupBatchId = randomUUID();

  const transactionResult = await app.db.transaction(async (tx) => {
    const [claimedChallenge] = await tx
      .update(mfaOtpChallenges)
      .set({ consumedAt: now })
      .where(
        and(
          eq(mfaOtpChallenges.id, body.challengeId),
          eq(mfaOtpChallenges.userId, currentUser.userId),
          eq(mfaOtpChallenges.purpose, ACCOUNT_DELETION_OTP_PURPOSE),
          eq(mfaOtpChallenges.codeHash, hashMfaOtpCode(body.code)),
          isNull(mfaOtpChallenges.consumedAt),
          gt(mfaOtpChallenges.expiresAt, now)
        )
      )
      .returning({ userId: mfaOtpChallenges.userId });

    if (!claimedChallenge) {
      return {
        status: "invalid_challenge" as const
      };
    }

    const [identity] = await tx
      .select({
        profileId: profiles.id,
        userId: users.id
      })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .where(
        and(
          eq(users.id, currentUser.userId),
          eq(profiles.id, currentUser.profile.id)
        )
      )
      .limit(1);

    if (!identity) {
      return {
        status: "not_found" as const
      };
    }

    const ownedListings = await tx
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.sellerProfileId, identity.profileId));

    const listingIds = ownedListings.map((listing) => listing.id);
    const ownedImages =
      listingIds.length > 0
        ? await tx
            .select({
              listingId: listingImages.listingId,
              url: listingImages.url
            })
            .from(listingImages)
            .where(inArray(listingImages.listingId, listingIds))
        : [];

    if (ownedImages.length > 0) {
      await tx
        .insert(accountDeletionStorageCleanupJobs)
        .values(
          ownedImages.map((image) => ({
            batchId: cleanupBatchId,
            profileId: identity.profileId,
            listingId: image.listingId,
            url: image.url
          }))
        )
        .onConflictDoNothing({
          target: [
            accountDeletionStorageCleanupJobs.batchId,
            accountDeletionStorageCleanupJobs.url
          ]
        });
    }

    if (listingIds.length > 0) {
      await tx
        .update(listings)
        .set({
          status: "archived",
          publicationState: "changes_requested",
          publishAfter: null,
          publishedAt: null,
          publicationReviewReason: "account_deleted",
          updatedAt: now
        })
        .where(inArray(listings.id, listingIds));

      await tx
        .update(shortLinks)
        .set({
          isActive: false,
          updatedAt: now
        })
        .where(
          and(
            eq(shortLinks.targetType, "listing"),
            inArray(shortLinks.targetId, listingIds)
          )
        );

      await tx
        .delete(listingImages)
        .where(inArray(listingImages.listingId, listingIds));
    }

    await tx
      .update(shortLinks)
      .set({
        createdByProfileId: null,
        updatedAt: now
      })
      .where(eq(shortLinks.createdByProfileId, identity.profileId));

    await tx
      .delete(notificationDeliveryLogs)
      .where(eq(notificationDeliveryLogs.profileId, identity.profileId));
    await tx
      .delete(notificationPreferenceAuditEvents)
      .where(eq(notificationPreferenceAuditEvents.profileId, identity.profileId));
    await tx
      .delete(notificationPreferences)
      .where(eq(notificationPreferences.profileId, identity.profileId));
    await tx
      .delete(notificationPushTokens)
      .where(eq(notificationPushTokens.profileId, identity.profileId));
    await tx
      .delete(notifications)
      .where(eq(notifications.recipientProfileId, identity.profileId));
    await tx
      .delete(childProfiles)
      .where(eq(childProfiles.profileId, identity.profileId));
    await tx
      .delete(favorites)
      .where(eq(favorites.profileId, identity.profileId));
    await tx
      .delete(cartItems)
      .where(eq(cartItems.buyerProfileId, identity.profileId));
    await tx
      .delete(savedSearches)
      .where(eq(savedSearches.profileId, identity.profileId));
    await tx
      .delete(blockedProfiles)
      .where(
        or(
          eq(blockedProfiles.blockerProfileId, identity.profileId),
          eq(blockedProfiles.blockedProfileId, identity.profileId)
        )
      );
    await tx
      .delete(profileTrustSnapshots)
      .where(eq(profileTrustSnapshots.profileId, identity.profileId));
    await tx
      .delete(conversationParticipants)
      .where(eq(conversationParticipants.profileId, identity.profileId));

    await tx
      .update(conversations)
      .set({
        status: "closed",
        updatedAt: now
      })
      .where(
        or(
          eq(conversations.profileLowId, identity.profileId),
          eq(conversations.profileHighId, identity.profileId)
        )
      );

    await tx
      .update(notifications)
      .set({ actorProfileId: null })
      .where(eq(notifications.actorProfileId, identity.profileId));
    await tx
      .update(notificationPreferenceAuditEvents)
      .set({ actorProfileId: null })
      .where(eq(notificationPreferenceAuditEvents.actorProfileId, identity.profileId));
    await tx
      .update(listingImages)
      .set({ reviewedByProfileId: null })
      .where(eq(listingImages.reviewedByProfileId, identity.profileId));
    await tx
      .update(profiles)
      .set({ safetyStatusUpdatedByProfileId: null })
      .where(eq(profiles.safetyStatusUpdatedByProfileId, identity.profileId));
    await tx
      .update(moderationActions)
      .set({ actorProfileId: null })
      .where(eq(moderationActions.actorProfileId, identity.profileId));
    await tx
      .update(marketplacePublicationSettings)
      .set({
        updatedByProfileId: null,
        updatedAt: now
      })
      .where(eq(marketplacePublicationSettings.updatedByProfileId, identity.profileId));
    await tx
      .update(events)
      .set({ actorProfileId: null })
      .where(eq(events.actorProfileId, identity.profileId));
    await tx
      .update(userSafetyEvents)
      .set({ profileId: null })
      .where(eq(userSafetyEvents.profileId, identity.profileId));
    await tx
      .update(analyticsEvents)
      .set({
        userId: null,
        profileId: null
      })
      .where(
        or(
          eq(analyticsEvents.userId, identity.userId),
          eq(analyticsEvents.profileId, identity.profileId)
        )
      );
    await tx
      .update(analyticsSessions)
      .set({ userId: null })
      .where(eq(analyticsSessions.userId, identity.userId));

    await tx
      .update(reports)
      .set({
        details: null,
        updatedAt: now
      })
      .where(
        or(
          eq(reports.reporterProfileId, identity.profileId),
          and(
            eq(reports.targetType, "profile"),
            eq(reports.targetId, identity.profileId)
          ),
          and(
            eq(reports.targetType, "listing"),
            sql`${reports.targetId} in (
              select ${listings.id}
              from ${listings}
              where ${listings.sellerProfileId} = ${identity.profileId}
            )`
          ),
          and(
            eq(reports.targetType, "message"),
            sql`${reports.targetId} in (
              select ${messages.id}
              from ${messages}
              where ${messages.senderProfileId} = ${identity.profileId}
            )`
          )
        )
      );

    await tx
      .update(profiles)
      .set({
        displayName: ACCOUNT_DELETION_TOMBSTONE_NAME,
        avatarUrl: null,
        locationCity: null,
        safetyStatus: "active",
        safetyStatusUpdatedAt: null,
        safetyStatusReasonCode: null,
        safetyStatusUpdatedByProfileId: null,
        updatedAt: now
      })
      .where(eq(profiles.id, identity.profileId));

    const [deletedUser] = await tx
      .delete(users)
      .where(eq(users.id, identity.userId))
      .returning({ id: users.id });

    if (!deletedUser) {
      throw new Error("Account deletion user removal failed.");
    }

    await tx.insert(events).values({
      actorProfileId: null,
      eventType: "account_deleted",
      entityType: "profile",
      entityId: identity.profileId,
      metadata: {
        cleanupBatchId,
        imageCount: ownedImages.length,
        listingCount: listingIds.length,
        version: 1
      }
    });

    return {
      status: "deleted" as const,
      cleanupBatchId,
      profileId: identity.profileId
    };
  });

  if (transactionResult.status === "invalid_challenge") {
    return {
      status: "invalid_challenge",
      response: invalidAccountDeletionChallenge()
    };
  }

  if (transactionResult.status === "not_found") {
    return {
      status: "not_found",
      response: accountDeletionIdentityNotFound()
    };
  }

  app.realtime?.io
    .in(realtimeProfileRoom(transactionResult.profileId))
    .disconnectSockets(true);

  let storageCleanup: AccountDeletionStorageCleanupSummary;

  try {
    storageCleanup = await processAccountDeletionStorageCleanupJobs(app, {
      batchId: transactionResult.cleanupBatchId,
      uploadRoot: options.uploadRoot
    });
  } catch {
    app.log.error(
      {
        batchId: transactionResult.cleanupBatchId,
        profileId: transactionResult.profileId
      },
      "Account deletion storage cleanup dispatch failed."
    );

    storageCleanup = {
      completedCount: 0,
      failedCount: 0,
      pendingCount: await countPendingCleanupJobs(
        app,
        transactionResult.cleanupBatchId
      )
    };
  }

  return {
    status: "deleted",
    response: {
      ok: true,
      data: {
        accountDeleted: true,
        profileId: transactionResult.profileId,
        storageCleanup
      }
    }
  };
}

export async function processAccountDeletionStorageCleanupJobs(
  app: FastifyInstance,
  options: {
    batchId?: string;
    deleteImage?: DeleteStoredImage;
    limit?: number;
    uploadRoot: string;
  }
): Promise<AccountDeletionStorageCleanupSummary> {
  const deleteImage =
    options.deleteImage ??
    ((input) => deleteStoredListingImage(input));
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const staleBefore = new Date(
    Date.now() - ACCOUNT_DELETION_CLEANUP_PROCESSING_STALE_MS
  );
  const claimableStatus = or(
    inArray(accountDeletionStorageCleanupJobs.status, ["pending", "failed"]),
    and(
      eq(accountDeletionStorageCleanupJobs.status, "processing"),
      lt(accountDeletionStorageCleanupJobs.updatedAt, staleBefore)
    )
  );
  const conditions = [
    claimableStatus,
    lt(
      accountDeletionStorageCleanupJobs.attemptCount,
      ACCOUNT_DELETION_CLEANUP_MAX_ATTEMPTS
    )
  ];

  if (options.batchId) {
    conditions.push(
      eq(accountDeletionStorageCleanupJobs.batchId, options.batchId)
    );
  }

  const candidates = await app.db
    .select({
      id: accountDeletionStorageCleanupJobs.id,
      url: accountDeletionStorageCleanupJobs.url
    })
    .from(accountDeletionStorageCleanupJobs)
    .where(and(...conditions))
    .orderBy(asc(accountDeletionStorageCleanupJobs.createdAt))
    .limit(limit);

  let completedCount = 0;
  let failedCount = 0;

  for (const candidate of candidates) {
    const claimedAt = new Date();
    const [claimed] = await app.db
      .update(accountDeletionStorageCleanupJobs)
      .set({
        status: "processing",
        attemptCount: sql`${accountDeletionStorageCleanupJobs.attemptCount} + 1`,
        lastErrorCode: null,
        lastErrorMessageRedacted: null,
        updatedAt: claimedAt
      })
      .where(
        and(
          eq(accountDeletionStorageCleanupJobs.id, candidate.id),
          or(
            inArray(accountDeletionStorageCleanupJobs.status, ["pending", "failed"]),
            and(
              eq(accountDeletionStorageCleanupJobs.status, "processing"),
              lt(accountDeletionStorageCleanupJobs.updatedAt, staleBefore)
            )
          ),
          lt(
            accountDeletionStorageCleanupJobs.attemptCount,
            ACCOUNT_DELETION_CLEANUP_MAX_ATTEMPTS
          )
        )
      )
      .returning({ id: accountDeletionStorageCleanupJobs.id });

    if (!claimed) {
      continue;
    }

    try {
      await deleteImage({
        uploadRoot: options.uploadRoot,
        url: candidate.url
      });

      const completedAt = new Date();

      await app.db
        .update(accountDeletionStorageCleanupJobs)
        .set({
          status: "completed",
          completedAt,
          updatedAt: completedAt
        })
        .where(eq(accountDeletionStorageCleanupJobs.id, candidate.id));

      completedCount += 1;
    } catch (error) {
      const failedAt = new Date();
      const errorCode = cleanupErrorCode(error);

      await app.db
        .update(accountDeletionStorageCleanupJobs)
        .set({
          status: "failed",
          lastErrorCode: errorCode,
          lastErrorMessageRedacted:
            "Storage cleanup failed. The retry worker will try again.",
          updatedAt: failedAt
        })
        .where(eq(accountDeletionStorageCleanupJobs.id, candidate.id));

      app.log.warn(
        {
          cleanupJobId: candidate.id,
          errorCode
        },
        "Account deletion storage cleanup job failed."
      );

      failedCount += 1;
    }
  }

  return {
    completedCount,
    failedCount,
    pendingCount: await countPendingCleanupJobs(app, options.batchId)
  };
}

export function registerAccountDeletionStorageCleanupWorker(
  app: FastifyInstance,
  options: {
    uploadRoot: string;
  }
): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  let timer: NodeJS.Timeout | null = null;
  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }

    running = true;

    try {
      await processAccountDeletionStorageCleanupJobs(app, {
        limit: 100,
        uploadRoot: options.uploadRoot
      });
    } catch (error) {
      app.log.error(error, "Account deletion storage cleanup worker failed.");
    } finally {
      running = false;
    }
  };

  app.addHook("onReady", async () => {
    await tick();
    timer = setInterval(() => {
      void tick();
    }, ACCOUNT_DELETION_CLEANUP_WORKER_INTERVAL_MS);
    timer.unref();
  });

  app.addHook("onClose", async () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  });
}

async function countPendingCleanupJobs(
  app: FastifyInstance,
  batchId?: string
): Promise<number> {
  const conditions = [
    inArray(accountDeletionStorageCleanupJobs.status, [
      "pending",
      "processing",
      "failed"
    ])
  ];

  if (batchId) {
    conditions.push(
      eq(accountDeletionStorageCleanupJobs.batchId, batchId)
    );
  }

  const [row] = await app.db
    .select({
      count: sql<number>`count(*)::int`
    })
    .from(accountDeletionStorageCleanupJobs)
    .where(and(...conditions));

  return row?.count ?? 0;
}

function cleanupErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code.slice(0, 80);
  }

  if (error instanceof Error && error.name) {
    return error.name.slice(0, 80);
  }

  return "STORAGE_CLEANUP_FAILED";
}

function accountDeletionForbidden(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "ACCOUNT_DELETION_FORBIDDEN",
      message:
        "Backoffice roles cannot delete themselves through the public account deletion flow."
    }
  };
}

function accountDeletionIdentityNotFound(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "ACCOUNT_DELETION_IDENTITY_NOT_FOUND",
      message: "The authenticated account could not be found."
    }
  };
}

function currentPasswordRequired(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "CURRENT_PASSWORD_REQUIRED",
      message: "Current password is required before requesting account deletion."
    }
  };
}

function invalidCurrentPassword(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "INVALID_CURRENT_PASSWORD",
      message: "Current password is invalid."
    }
  };
}

function invalidAccountDeletionChallenge(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "ACCOUNT_DELETION_CHALLENGE_INVALID",
      message: "Account deletion code is invalid, expired, or already used."
    }
  };
}

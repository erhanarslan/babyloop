import {
  events,
  listingImages,
  listings,
  marketplacePublicationSettings
} from "@babyloop/database/schema";
import { and, eq, inArray, lte, not, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { createNotification } from "./notifications.service.js";

export const LISTING_PUBLICATION_SETTINGS_ID = 1;
export const LISTING_PUBLICATION_SETTINGS_AUDIT_ENTITY_ID =
  "00000000-0000-0000-0000-000000000001";
export const DEFAULT_AUTO_PUBLISH_DELAY_SECONDS = 30;
export const LISTING_PUBLICATION_WORKER_INTERVAL_MS = 5_000;

export type ListingPublicationState =
  | "awaiting_images"
  | "ai_review"
  | "admin_review"
  | "scheduled"
  | "published"
  | "changes_requested";

export type MarketplacePublicationSettings = {
  adminReviewEnabled: boolean;
  autoPublishDelaySeconds: number;
  updatedByProfileId: string | null;
  updatedAt: string;
};

type ListingPublicationSnapshot = {
  id: string;
  sellerProfileId: string;
  status: string;
  publicationState: ListingPublicationState;
  publishAfter: Date | null;
  publishedAt: Date | null;
  publicationReviewReason: string | null;
};

type ImageReviewCounts = {
  approved: number;
  pending: number;
  needsReview: number;
};

export async function getMarketplacePublicationSettings(
  app: FastifyInstance
): Promise<MarketplacePublicationSettings> {
  const [row] = await app.db
    .select({
      adminReviewEnabled: marketplacePublicationSettings.adminReviewEnabled,
      autoPublishDelaySeconds: marketplacePublicationSettings.autoPublishDelaySeconds,
      updatedByProfileId: marketplacePublicationSettings.updatedByProfileId,
      updatedAt: marketplacePublicationSettings.updatedAt
    })
    .from(marketplacePublicationSettings)
    .where(eq(marketplacePublicationSettings.id, LISTING_PUBLICATION_SETTINGS_ID))
    .limit(1);

  if (row) {
    return {
      ...row,
      updatedAt: row.updatedAt.toISOString()
    };
  }

  const [created] = await app.db
    .insert(marketplacePublicationSettings)
    .values({
      id: LISTING_PUBLICATION_SETTINGS_ID,
      adminReviewEnabled: false,
      autoPublishDelaySeconds: DEFAULT_AUTO_PUBLISH_DELAY_SECONDS
    })
    .onConflictDoNothing({ target: marketplacePublicationSettings.id })
    .returning({
      adminReviewEnabled: marketplacePublicationSettings.adminReviewEnabled,
      autoPublishDelaySeconds: marketplacePublicationSettings.autoPublishDelaySeconds,
      updatedByProfileId: marketplacePublicationSettings.updatedByProfileId,
      updatedAt: marketplacePublicationSettings.updatedAt
    });

  if (created) {
    return {
      ...created,
      updatedAt: created.updatedAt.toISOString()
    };
  }

  return getMarketplacePublicationSettings(app);
}

export async function updateMarketplacePublicationSettings(
  app: FastifyInstance,
  input: {
    actorProfileId: string;
    adminReviewEnabled: boolean;
    autoPublishDelaySeconds: number;
  }
): Promise<MarketplacePublicationSettings> {
  const previous = await getMarketplacePublicationSettings(app);
  const now = new Date();

  const updated = await app.db.transaction(async (tx) => {
    const [settings] = await tx
      .insert(marketplacePublicationSettings)
      .values({
        id: LISTING_PUBLICATION_SETTINGS_ID,
        adminReviewEnabled: input.adminReviewEnabled,
        autoPublishDelaySeconds: input.autoPublishDelaySeconds,
        updatedByProfileId: input.actorProfileId,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: marketplacePublicationSettings.id,
        set: {
          adminReviewEnabled: input.adminReviewEnabled,
          autoPublishDelaySeconds: input.autoPublishDelaySeconds,
          updatedByProfileId: input.actorProfileId,
          updatedAt: now
        }
      })
      .returning({
        adminReviewEnabled: marketplacePublicationSettings.adminReviewEnabled,
        autoPublishDelaySeconds: marketplacePublicationSettings.autoPublishDelaySeconds,
        updatedByProfileId: marketplacePublicationSettings.updatedByProfileId,
        updatedAt: marketplacePublicationSettings.updatedAt
      });

    if (!settings) {
      throw new Error("Marketplace publication settings update failed.");
    }

    if (input.adminReviewEnabled) {
      await tx
        .update(listings)
        .set({
          publicationState: "admin_review",
          publishAfter: null,
          updatedAt: now
        })
        .where(
          and(
            eq(listings.status, "draft"),
            eq(listings.publicationState, "scheduled")
          )
        );
    } else {
      const publishAfter = addSeconds(now, input.autoPublishDelaySeconds);

      await tx
        .update(listings)
        .set({
          publicationState: "scheduled",
          publishAfter,
          publicationReviewReason: null,
          updatedAt: now
        })
        .where(
          and(
            eq(listings.status, "draft"),
            inArray(listings.publicationState, ["admin_review", "scheduled"]),
            hasApprovedImageSql(),
            not(hasBlockingImageReviewSql())
          )
        );
    }

    await tx.insert(events).values({
      actorProfileId: input.actorProfileId,
      eventType: "listing_publication_settings_changed",
      entityType: "marketplace_publication_settings",
      entityId: LISTING_PUBLICATION_SETTINGS_AUDIT_ENTITY_ID,
      metadata: {
        previousAdminReviewEnabled: previous.adminReviewEnabled,
        nextAdminReviewEnabled: input.adminReviewEnabled,
        previousAutoPublishDelaySeconds: previous.autoPublishDelaySeconds,
        nextAutoPublishDelaySeconds: input.autoPublishDelaySeconds
      }
    });

    return settings;
  });

  return {
    ...updated,
    updatedAt: updated.updatedAt.toISOString()
  };
}

export async function reconcileListingPublication(
  app: FastifyInstance,
  listingId: string,
  options: {
    actorProfileId?: string | null;
    trigger: string;
    resubmit?: boolean;
  }
): Promise<ListingPublicationSnapshot | null> {
  const listing = await getListingPublicationSnapshot(app, listingId);

  if (!listing) {
    return null;
  }

  if (listing.status === "sold" || listing.status === "archived") {
    if (listing.publishAfter) {
      await app.db
        .update(listings)
        .set({ publishAfter: null, updatedAt: new Date() })
        .where(eq(listings.id, listingId));
    }

    return getListingPublicationSnapshot(app, listingId);
  }

  const counts = await getImageReviewCounts(app, listingId);
  const hasBlockingReview = counts.pending > 0 || counts.needsReview > 0;
  const now = new Date();

  let nextStatus = listing.status;
  let nextState = listing.publicationState;
  let nextPublishAfter = listing.publishAfter;
  let nextPublishedAt = listing.publishedAt;
  let nextReason = listing.publicationReviewReason;

  if (counts.approved === 0) {
    nextStatus = "draft";
    nextState = hasBlockingReview ? "ai_review" : "awaiting_images";
    nextPublishAfter = null;
    nextPublishedAt = null;
    nextReason = null;
  } else if (listing.status === "active" || listing.status === "reserved") {
    nextState = "published";
    nextPublishAfter = null;
    nextPublishedAt = listing.publishedAt ?? now;
    nextReason = null;
  } else if (hasBlockingReview) {
    nextStatus = "draft";
    nextState = "ai_review";
    nextPublishAfter = null;
    nextPublishedAt = null;
    nextReason = null;
  } else if (listing.publicationState === "changes_requested" && !options.resubmit) {
    nextStatus = "draft";
    nextState = "changes_requested";
    nextPublishAfter = null;
  } else {
    const settings = await getMarketplacePublicationSettings(app);
    nextStatus = "draft";
    nextReason = null;
    nextPublishedAt = null;

    if (settings.adminReviewEnabled) {
      nextState = "admin_review";
      nextPublishAfter = null;
    } else {
      nextState = "scheduled";
      nextPublishAfter =
        listing.publicationState === "scheduled" && listing.publishAfter
          ? listing.publishAfter
          : addSeconds(now, settings.autoPublishDelaySeconds);
    }
  }

  const changed =
    nextStatus !== listing.status ||
    nextState !== listing.publicationState ||
    dateValue(nextPublishAfter) !== dateValue(listing.publishAfter) ||
    dateValue(nextPublishedAt) !== dateValue(listing.publishedAt) ||
    nextReason !== listing.publicationReviewReason;

  if (!changed) {
    return listing;
  }

  await app.db.transaction(async (tx) => {
    await tx
      .update(listings)
      .set({
        status: nextStatus as "draft" | "active" | "reserved" | "sold" | "archived",
        publicationState: nextState,
        publishAfter: nextPublishAfter,
        publishedAt: nextPublishedAt,
        publicationReviewReason: nextReason,
        updatedAt: now
      })
      .where(eq(listings.id, listingId));

    await tx.insert(events).values({
      actorProfileId: options.actorProfileId ?? null,
      eventType: "listing_publication_state_changed",
      entityType: "listing",
      entityId: listingId,
      metadata: {
        previousStatus: listing.status,
        nextStatus,
        previousPublicationState: listing.publicationState,
        nextPublicationState: nextState,
        publishAfter: nextPublishAfter?.toISOString() ?? null,
        trigger: options.trigger
      }
    });
  });

  return getListingPublicationSnapshot(app, listingId);
}

export async function approveListingPublication(
  app: FastifyInstance,
  input: {
    actorProfileId: string;
    listingId: string;
    reason: string;
  }
): Promise<
  | { status: "applied"; listing: ListingPublicationSnapshot; auditEventId: string }
  | { status: "not_found" | "approved_image_required" | "image_review_pending" | "invalid_state" }
> {
  const listing = await getListingPublicationSnapshot(app, input.listingId);

  if (!listing) {
    return { status: "not_found" };
  }

  if (
    listing.status !== "draft" ||
    (listing.publicationState !== "admin_review" &&
      listing.publicationState !== "scheduled")
  ) {
    return { status: "invalid_state" };
  }

  const counts = await getImageReviewCounts(app, input.listingId);

  if (counts.approved === 0) {
    return { status: "approved_image_required" };
  }

  if (counts.pending > 0 || counts.needsReview > 0) {
    return { status: "image_review_pending" };
  }

  const now = new Date();
  const applied = await app.db.transaction(async (tx) => {
    const [updated] = await tx
      .update(listings)
      .set({
        status: "active",
        publicationState: "published",
        publishAfter: null,
        publishedAt: now,
        publicationReviewReason: null,
        updatedAt: now
      })
      .where(
        and(
          eq(listings.id, input.listingId),
          eq(listings.status, "draft"),
          inArray(listings.publicationState, ["admin_review", "scheduled"]),
          hasApprovedImageSql(),
          not(hasBlockingImageReviewSql())
        )
      )
      .returning({
        id: listings.id,
        sellerProfileId: listings.sellerProfileId,
        status: listings.status,
        publicationState: listings.publicationState,
        publishAfter: listings.publishAfter,
        publishedAt: listings.publishedAt,
        publicationReviewReason: listings.publicationReviewReason
      });

    if (!updated) {
      return null;
    }

    const [event] = await tx
      .insert(events)
      .values({
        actorProfileId: input.actorProfileId,
        eventType: "listing_publication_approved",
        entityType: "listing",
        entityId: input.listingId,
        metadata: {
          previousStatus: listing.status,
          previousPublicationState: listing.publicationState,
          reasonLength: input.reason.length
        }
      })
      .returning({ id: events.id });

    if (!event) {
      throw new Error("Listing publication approval audit failed.");
    }

    return { updatedListing: updated, auditEvent: event };
  });

  if (!applied) {
    return { status: "invalid_state" };
  }

  const { updatedListing, auditEvent } = applied;

  await createPublicationNotification(app, {
    listingId: input.listingId,
    recipientProfileId: updatedListing.sellerProfileId,
    title: "İlanın yayında",
    body: "İlanının kontrolü tamamlandı ve yayına alındı.",
    publicationState: "published"
  });

  return {
    status: "applied",
    listing: updatedListing,
    auditEventId: auditEvent.id
  };
}

export async function requestListingPublicationChanges(
  app: FastifyInstance,
  input: {
    actorProfileId: string;
    listingId: string;
    reason: string;
  }
): Promise<
  | { status: "applied"; listing: ListingPublicationSnapshot; auditEventId: string }
  | { status: "not_found" | "invalid_state" }
> {
  const listing = await getListingPublicationSnapshot(app, input.listingId);

  if (!listing) {
    return { status: "not_found" };
  }

  if (
    listing.status !== "draft" ||
    listing.publicationState === "awaiting_images" ||
    listing.publicationState === "changes_requested" ||
    listing.publicationState === "published"
  ) {
    return { status: "invalid_state" };
  }

  const now = new Date();
  const applied = await app.db.transaction(async (tx) => {
    const [updated] = await tx
      .update(listings)
      .set({
        status: "draft",
        publicationState: "changes_requested",
        publishAfter: null,
        publishedAt: null,
        publicationReviewReason: input.reason.trim(),
        updatedAt: now
      })
      .where(
        and(
          eq(listings.id, input.listingId),
          eq(listings.status, "draft"),
          inArray(listings.publicationState, ["ai_review", "admin_review", "scheduled"])
        )
      )
      .returning({
        id: listings.id,
        sellerProfileId: listings.sellerProfileId,
        status: listings.status,
        publicationState: listings.publicationState,
        publishAfter: listings.publishAfter,
        publishedAt: listings.publishedAt,
        publicationReviewReason: listings.publicationReviewReason
      });

    if (!updated) {
      return null;
    }

    const [event] = await tx
      .insert(events)
      .values({
        actorProfileId: input.actorProfileId,
        eventType: "listing_publication_changes_requested",
        entityType: "listing",
        entityId: input.listingId,
        metadata: {
          previousStatus: listing.status,
          previousPublicationState: listing.publicationState,
          reasonLength: input.reason.length
        }
      })
      .returning({ id: events.id });

    if (!event) {
      throw new Error("Listing publication change request audit failed.");
    }

    return { updatedListing: updated, auditEvent: event };
  });

  if (!applied) {
    return { status: "invalid_state" };
  }

  const { updatedListing, auditEvent } = applied;

  await createPublicationNotification(app, {
    listingId: input.listingId,
    recipientProfileId: updatedListing.sellerProfileId,
    title: "İlanında düzenleme gerekiyor",
    body: "İlanını düzenleyip yeniden onay sürecine gönderebilirsin.",
    publicationState: "changes_requested"
  });

  return {
    status: "applied",
    listing: updatedListing,
    auditEventId: auditEvent.id
  };
}

export async function processDueListingPublications(
  app: FastifyInstance,
  options: { now?: Date; limit?: number } = {}
): Promise<number> {
  const settings = await getMarketplacePublicationSettings(app);

  if (settings.adminReviewEnabled) {
    return 0;
  }

  const now = options.now ?? new Date();
  const dueListings = await app.db
    .select({ id: listings.id })
    .from(listings)
    .where(
      and(
        eq(listings.status, "draft"),
        eq(listings.publicationState, "scheduled"),
        lte(listings.publishAfter, now)
      )
    )
    .limit(options.limit ?? 100);

  let publishedCount = 0;

  for (const dueListing of dueListings) {
    const published = await app.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(listings)
        .set({
          status: "active",
          publicationState: "published",
          publishAfter: null,
          publishedAt: now,
          publicationReviewReason: null,
          updatedAt: now
        })
        .where(
          and(
            eq(listings.id, dueListing.id),
            eq(listings.status, "draft"),
            eq(listings.publicationState, "scheduled"),
            lte(listings.publishAfter, now),
            hasApprovedImageSql(),
            not(hasBlockingImageReviewSql()),
            sql`exists (
              select 1
              from ${marketplacePublicationSettings}
              where ${marketplacePublicationSettings.id} = ${LISTING_PUBLICATION_SETTINGS_ID}
                and ${marketplacePublicationSettings.adminReviewEnabled} = false
            )`
          )
        )
        .returning({
          id: listings.id,
          sellerProfileId: listings.sellerProfileId
        });

      if (!updated) {
        return null;
      }

      await tx.insert(events).values({
        actorProfileId: null,
        eventType: "listing_auto_published",
        entityType: "listing",
        entityId: updated.id,
        metadata: {
          trigger: "publication_worker",
          publishedAt: now.toISOString()
        }
      });

      return updated;
    });

    if (!published) {
      continue;
    }

    publishedCount += 1;

    await createPublicationNotification(app, {
      listingId: published.id,
      recipientProfileId: published.sellerProfileId,
      title: "İlanın yayında",
      body: "İlanının kontrolü tamamlandı ve yayına alındı.",
      publicationState: "published"
    });
  }

  return publishedCount;
}

export function registerListingPublicationWorker(app: FastifyInstance): void {
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
      await processDueListingPublications(app);
    } catch (error) {
      app.log.error(error, "Listing publication worker failed.");
    } finally {
      running = false;
    }
  };

  app.addHook("onReady", async () => {
    await tick();
    timer = setInterval(() => {
      void tick();
    }, LISTING_PUBLICATION_WORKER_INTERVAL_MS);
    timer.unref();
  });

  app.addHook("onClose", async () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  });
}

async function getListingPublicationSnapshot(
  app: FastifyInstance,
  listingId: string
): Promise<ListingPublicationSnapshot | null> {
  const [listing] = await app.db
    .select({
      id: listings.id,
      sellerProfileId: listings.sellerProfileId,
      status: listings.status,
      publicationState: listings.publicationState,
      publishAfter: listings.publishAfter,
      publishedAt: listings.publishedAt,
      publicationReviewReason: listings.publicationReviewReason
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  return listing ?? null;
}

async function getImageReviewCounts(
  app: FastifyInstance,
  listingId: string
): Promise<ImageReviewCounts> {
  const [row] = await app.db
    .select({
      approved: sql<number>`count(*) filter (where ${listingImages.reviewStatus} = 'approved')::int`,
      pending: sql<number>`count(*) filter (where ${listingImages.reviewStatus} = 'pending')::int`,
      needsReview: sql<number>`count(*) filter (where ${listingImages.reviewStatus} = 'needs_review')::int`
    })
    .from(listingImages)
    .where(eq(listingImages.listingId, listingId));

  return {
    approved: row?.approved ?? 0,
    pending: row?.pending ?? 0,
    needsReview: row?.needsReview ?? 0
  };
}

function hasApprovedImageSql() {
  return sql`exists (
    select 1
    from ${listingImages}
    where ${listingImages.listingId} = ${listings.id}
      and ${listingImages.reviewStatus} = 'approved'
  )`;
}

function hasBlockingImageReviewSql() {
  return sql`exists (
    select 1
    from ${listingImages}
    where ${listingImages.listingId} = ${listings.id}
      and ${listingImages.reviewStatus} in ('pending', 'needs_review')
  )`;
}

async function createPublicationNotification(
  app: FastifyInstance,
  input: {
    listingId: string;
    recipientProfileId: string;
    title: string;
    body: string;
    publicationState: ListingPublicationState;
  }
): Promise<void> {
  try {
    await createNotification(app, {
      recipientProfileId: input.recipientProfileId,
      type: "listing_status_changed",
      title: input.title,
      body: input.body,
      entityType: "listing",
      entityId: input.listingId,
      metadata: {
        publicationState: input.publicationState
      }
    });
  } catch (error) {
    app.log.warn(
      {
        error,
        listingId: input.listingId,
        publicationState: input.publicationState
      },
      "Listing publication notification could not be created."
    );
  }
}

function addSeconds(value: Date, seconds: number): Date {
  return new Date(value.getTime() + seconds * 1000);
}

function dateValue(value: Date | null): number | null {
  return value?.getTime() ?? null;
}

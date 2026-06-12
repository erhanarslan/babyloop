import {
  events,
  listingImages,
  listings,
  moderationCases,
  productCategories,
  profiles,
  reports
} from "@babyloop/database/schema";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type {
  AdminListingImageActionValue,
  AdminListingActionValue,
  AdminListingStatusValue
} from "../schemas/admin-listings.schemas.js";
import { buildPrice, type CategoryBasicResponse, type PriceResponse } from "./listing-response.mapper.js";

export type AdminListingSort =
  | "newest"
  | "oldest"
  | "updated_desc"
  | "updated_asc";

export type AdminListingSellerSummary = {
  profileId: string;
  displayName: string;
  locationCity: string | null;
  createdAt: string;
};

export type AdminListingImageReview = {
  id: string;
  url: string;
  sortOrder: number;
  reviewStatus: "approved" | "rejected";
  reviewedAt: string | null;
  reviewedByProfileId: string | null;
  createdAt: string;
};

export type AdminListingModerationSummary = {
  relatedCaseCount: number;
  openRelatedCaseCount: number;
};

export type AdminListingRelatedCase = {
  caseId: string;
  reportId: string | null;
  status: string;
  targetType: "listing" | "profile" | "message";
  targetId: string;
  reason: string | null;
  reportStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminListingActionEligibility = {
  canArchive: boolean;
  canRestore: boolean;
  supportedActions: AdminListingActionValue[];
};

export type AdminListingSummary = {
  id: string;
  title: string;
  description: string | null;
  price: PriceResponse;
  currency: string;
  status: string;
  listingType: string;
  condition: string;
  category: CategoryBasicResponse;
  seller: AdminListingSellerSummary;
  primaryImage: AdminListingImageReview | null;
  imageCount: number;
  moderation: AdminListingModerationSummary;
  createdAt: string;
  updatedAt: string;
};

export type AdminListingDetail = AdminListingSummary & {
  images: AdminListingImageReview[];
  relatedModerationCases: AdminListingRelatedCase[];
  actionEligibility: AdminListingActionEligibility;
  auditTrail: AdminListingAuditEvent[];
};

export type AdminListingAuditEvent = {
  id: string;
  eventType: string;
  createdAt: string;
  actor: {
    id: string;
    displayName: string | null;
  } | null;
  metadata: Record<string, string | number | boolean | string[] | null>;
};

export type AdminListingActionResult =
  | {
      status: "applied";
      listingId: string;
      action: AdminListingActionValue;
      previousStatus: string;
      nextStatus: string;
      auditEventId: string;
    }
  | { status: "not_found" | "unsupported_action" };

export type AdminListingImageActionResult =
  | {
      status: "applied";
      image: AdminListingImageReview;
      auditEventId: string;
    }
  | { status: "not_found" | "image_not_found" | "unsupported_action" };

export async function listAdminListings(
  app: FastifyInstance,
  filters: {
    status?: AdminListingStatusValue;
    q?: string;
    categoryId?: string;
    sort?: AdminListingSort;
    limit?: number;
  }
): Promise<AdminListingSummary[]> {
  const rows = await selectAdminListingRows(app, filters);

  return hydrateAdminListingSummaries(app, rows);
}

export async function getAdminListingDetail(
  app: FastifyInstance,
  listingId: string
): Promise<AdminListingDetail | null> {
  const rows = await selectAdminListingRows(app, {
    q: listingId,
    limit: 1
  });
  const row = rows.find((item) => item.id === listingId);

  if (!row) {
    return null;
  }

  const [summary] = await hydrateAdminListingSummaries(app, [row]);

  if (!summary) {
    return null;
  }

  const [images, relatedModerationCases, auditTrail] = await Promise.all([
    loadAdminListingImages(app, listingId),
    loadRelatedModerationCases(app, listingId),
    loadAdminListingAuditTrail(app, listingId)
  ]);

  return {
    ...summary,
    images,
    relatedModerationCases,
    actionEligibility: getActionEligibility(summary.status),
    auditTrail
  };
}

export async function applyAdminListingAction(
  app: FastifyInstance,
  params: {
    actorProfileId: string;
    listingId: string;
    action: AdminListingActionValue;
    reason: string;
  }
): Promise<AdminListingActionResult> {
  const [listing] = await app.db
    .select({
      id: listings.id,
      status: listings.status
    })
    .from(listings)
    .where(eq(listings.id, params.listingId))
    .limit(1);

  if (!listing) {
    return { status: "not_found" };
  }

  const nextStatus = getNextStatusForAction(params.action);

  if (!nextStatus) {
    return { status: "unsupported_action" };
  }

  const [auditEvent] = await app.db.transaction(async (tx) => {
    await tx
      .update(listings)
      .set({
        status: nextStatus,
        updatedAt: new Date()
      })
      .where(eq(listings.id, params.listingId));

    return tx
      .insert(events)
      .values({
        actorProfileId: params.actorProfileId,
        eventType: "admin_listing_action_applied",
        entityType: "listing",
        entityId: params.listingId,
        metadata: {
          listingId: params.listingId,
          action: params.action,
          previousStatus: listing.status,
          nextStatus,
          reasonLength: params.reason.length
        }
      })
      .returning({
        id: events.id
      });
  });

  if (!auditEvent) {
    throw new Error("Admin listing action audit event creation failed.");
  }

  return {
    status: "applied",
    listingId: params.listingId,
    action: params.action,
    previousStatus: listing.status,
    nextStatus,
    auditEventId: auditEvent.id
  };
}

export async function applyAdminListingImageAction(
  app: FastifyInstance,
  params: {
    actorProfileId: string;
    action: AdminListingImageActionValue;
    imageId: string;
    listingId: string;
    reason: string;
  }
): Promise<AdminListingImageActionResult> {
  const [listing] = await app.db
    .select({
      id: listings.id
    })
    .from(listings)
    .where(eq(listings.id, params.listingId))
    .limit(1);

  if (!listing) {
    return { status: "not_found" };
  }

  const [image] = await app.db
    .select({
      id: listingImages.id,
      listingId: listingImages.listingId,
      reviewStatus: listingImages.reviewStatus
    })
    .from(listingImages)
    .where(and(eq(listingImages.id, params.imageId), eq(listingImages.listingId, params.listingId)))
    .limit(1);

  if (!image) {
    return { status: "image_not_found" };
  }

  const nextReviewStatus = getNextReviewStatusForAction(params.action);

  if (!nextReviewStatus) {
    return { status: "unsupported_action" };
  }

  const result = await app.db.transaction(async (tx) => {
    const now = new Date();
    const [updatedImage] = await tx
      .update(listingImages)
      .set({
        reviewStatus: nextReviewStatus,
        reviewedAt: now,
        reviewedByProfileId: params.actorProfileId
      })
      .where(and(eq(listingImages.id, params.imageId), eq(listingImages.listingId, params.listingId)))
      .returning({
        id: listingImages.id,
        url: listingImages.url,
        sortOrder: listingImages.sortOrder,
        reviewStatus: listingImages.reviewStatus,
        reviewedAt: listingImages.reviewedAt,
        reviewedByProfileId: listingImages.reviewedByProfileId,
        createdAt: listingImages.createdAt
      });

    const [auditEvent] = await tx
      .insert(events)
      .values({
        actorProfileId: params.actorProfileId,
        eventType: "admin_listing_image_review_applied",
        entityType: "listing",
        entityId: params.listingId,
        metadata: {
          listingId: params.listingId,
          imageId: params.imageId,
          action: params.action,
          previousReviewStatus: image.reviewStatus,
          nextReviewStatus,
          reasonLength: params.reason.length,
          result: "applied"
        }
      })
      .returning({
        id: events.id
      });

    if (!updatedImage || !auditEvent) {
      throw new Error("Admin listing image review audit creation failed.");
    }

    return {
      auditEventId: auditEvent.id,
      image: updatedImage
    };
  });

  return {
    status: "applied",
    image: mapImage(result.image),
    auditEventId: result.auditEventId
  };
}

type AdminListingRow = {
  id: string;
  title: string;
  description: string | null;
  priceAmount: string | null;
  currency: string;
  status: string;
  listingType: string;
  condition: string;
  createdAt: Date;
  updatedAt: Date;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  sellerProfileId: string;
  sellerDisplayName: string;
  sellerLocationCity: string | null;
  sellerCreatedAt: Date;
};

async function selectAdminListingRows(
  app: FastifyInstance,
  filters: {
    status?: AdminListingStatusValue;
    q?: string;
    categoryId?: string;
    sort?: AdminListingSort;
    limit?: number;
  }
): Promise<AdminListingRow[]> {
  const normalizedQuery = filters.q?.trim() ?? "";
  const searchPattern = `%${normalizedQuery}%`;
  const whereConditions = [
    filters.status ? eq(listings.status, filters.status) : undefined,
    filters.categoryId ? eq(listings.categoryId, filters.categoryId) : undefined,
    normalizedQuery
      ? or(
          sql`${listings.id}::text ilike ${searchPattern}`,
          ilike(listings.title, searchPattern),
          ilike(listings.description, searchPattern),
          sql`${listings.status}::text ilike ${searchPattern}`,
          sql`${listings.sellerProfileId}::text ilike ${searchPattern}`,
          sql`${productCategories.id}::text ilike ${searchPattern}`,
          ilike(productCategories.name, searchPattern)
        )
      : undefined
  ].filter(Boolean);

  return app.db
    .select({
      id: listings.id,
      title: listings.title,
      description: listings.description,
      priceAmount: listings.priceAmount,
      currency: listings.currency,
      status: listings.status,
      listingType: listings.listingType,
      condition: listings.condition,
      createdAt: listings.createdAt,
      updatedAt: listings.updatedAt,
      categoryId: productCategories.id,
      categoryName: productCategories.name,
      categorySlug: productCategories.slug,
      sellerProfileId: profiles.id,
      sellerDisplayName: profiles.displayName,
      sellerLocationCity: profiles.locationCity,
      sellerCreatedAt: profiles.createdAt
    })
    .from(listings)
    .innerJoin(productCategories, eq(listings.categoryId, productCategories.id))
    .innerJoin(profiles, eq(listings.sellerProfileId, profiles.id))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(getAdminListingOrderBy(filters.sort))
    .limit(filters.limit ?? 50);
}

async function hydrateAdminListingSummaries(
  app: FastifyInstance,
  rows: AdminListingRow[]
): Promise<AdminListingSummary[]> {
  const listingIds = rows.map((row) => row.id);
  const [primaryImages, imageCounts, moderationSummaries] = await Promise.all([
    loadPrimaryImages(app, listingIds),
    loadImageCounts(app, listingIds),
    loadModerationSummaries(app, listingIds)
  ]);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    price: buildPrice(row.priceAmount, row.currency),
    currency: row.currency,
    status: row.status,
    listingType: row.listingType,
    condition: row.condition,
    category: {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug
    },
    seller: {
      profileId: row.sellerProfileId,
      displayName: row.sellerDisplayName,
      locationCity: row.sellerLocationCity,
      createdAt: row.sellerCreatedAt.toISOString()
    },
    primaryImage: primaryImages.get(row.id) ?? null,
    imageCount: imageCounts.get(row.id) ?? 0,
    moderation: moderationSummaries.get(row.id) ?? {
      relatedCaseCount: 0,
      openRelatedCaseCount: 0
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }));
}

async function loadPrimaryImages(
  app: FastifyInstance,
  listingIds: string[]
): Promise<Map<string, AdminListingImageReview>> {
  if (listingIds.length === 0) {
    return new Map();
  }

  const rows = await app.db
    .select({
      id: listingImages.id,
      listingId: listingImages.listingId,
      url: listingImages.url,
      sortOrder: listingImages.sortOrder,
      reviewStatus: listingImages.reviewStatus,
      reviewedAt: listingImages.reviewedAt,
      reviewedByProfileId: listingImages.reviewedByProfileId,
      createdAt: listingImages.createdAt
    })
    .from(listingImages)
    .where(inArray(listingImages.listingId, listingIds))
    .orderBy(asc(listingImages.listingId), asc(listingImages.sortOrder));

  const images = new Map<string, AdminListingImageReview>();

  for (const row of rows) {
    if (images.has(row.listingId)) {
      continue;
    }

    images.set(row.listingId, mapImage(row));
  }

  return images;
}

async function loadImageCounts(
  app: FastifyInstance,
  listingIds: string[]
): Promise<Map<string, number>> {
  if (listingIds.length === 0) {
    return new Map();
  }

  const rows = await app.db
    .select({
      listingId: listingImages.listingId,
      imageCount: count(listingImages.id)
    })
    .from(listingImages)
    .where(inArray(listingImages.listingId, listingIds))
    .groupBy(listingImages.listingId);

  return new Map(rows.map((row) => [row.listingId, Number(row.imageCount)]));
}

async function loadAdminListingImages(
  app: FastifyInstance,
  listingId: string
): Promise<AdminListingImageReview[]> {
  const rows = await app.db
    .select({
      id: listingImages.id,
      url: listingImages.url,
      sortOrder: listingImages.sortOrder,
      reviewStatus: listingImages.reviewStatus,
      reviewedAt: listingImages.reviewedAt,
      reviewedByProfileId: listingImages.reviewedByProfileId,
      createdAt: listingImages.createdAt
    })
    .from(listingImages)
    .where(eq(listingImages.listingId, listingId))
    .orderBy(asc(listingImages.sortOrder));

  return rows.map(mapImage);
}

async function loadModerationSummaries(
  app: FastifyInstance,
  listingIds: string[]
): Promise<Map<string, AdminListingModerationSummary>> {
  if (listingIds.length === 0) {
    return new Map();
  }

  const rows = await app.db
    .select({
      listingId: moderationCases.targetId,
      status: moderationCases.status,
      caseCount: count(moderationCases.id)
    })
    .from(moderationCases)
    .where(
      and(
        eq(moderationCases.targetType, "listing"),
        inArray(moderationCases.targetId, listingIds)
      )
    )
    .groupBy(moderationCases.targetId, moderationCases.status);

  const summaries = new Map<string, AdminListingModerationSummary>();

  for (const row of rows) {
    const existing = summaries.get(row.listingId) ?? {
      relatedCaseCount: 0,
      openRelatedCaseCount: 0
    };
    const caseCount = Number(row.caseCount);

    existing.relatedCaseCount += caseCount;

    if (row.status === "pending" || row.status === "in_review") {
      existing.openRelatedCaseCount += caseCount;
    }

    summaries.set(row.listingId, existing);
  }

  return summaries;
}

async function loadRelatedModerationCases(
  app: FastifyInstance,
  listingId: string
): Promise<AdminListingRelatedCase[]> {
  const rows = await app.db
    .select({
      caseId: moderationCases.id,
      reportId: reports.id,
      status: moderationCases.status,
      targetType: moderationCases.targetType,
      targetId: moderationCases.targetId,
      reason: reports.reason,
      reportStatus: reports.status,
      createdAt: moderationCases.createdAt,
      updatedAt: moderationCases.updatedAt
    })
    .from(moderationCases)
    .leftJoin(reports, eq(moderationCases.reportId, reports.id))
    .where(and(eq(moderationCases.targetType, "listing"), eq(moderationCases.targetId, listingId)))
    .orderBy(desc(moderationCases.createdAt));

  return rows.map((row) => ({
    caseId: row.caseId,
    reportId: row.reportId,
    status: row.status,
    targetType: row.targetType,
    targetId: row.targetId,
    reason: row.reason,
    reportStatus: row.reportStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }));
}

async function loadAdminListingAuditTrail(
  app: FastifyInstance,
  listingId: string
): Promise<AdminListingAuditEvent[]> {
  const relatedCases = await app.db
    .select({
      id: moderationCases.id
    })
    .from(moderationCases)
    .where(and(eq(moderationCases.targetType, "listing"), eq(moderationCases.targetId, listingId)));
  const relatedCaseIds = relatedCases.map((moderationCase) => moderationCase.id);
  const rows = await app.db
    .select({
      id: events.id,
      eventType: events.eventType,
      metadata: events.metadata,
      createdAt: events.createdAt,
      actorProfileId: profiles.id,
      actorDisplayName: profiles.displayName
    })
    .from(events)
    .leftJoin(profiles, eq(events.actorProfileId, profiles.id))
    .where(
      or(
        and(eq(events.entityType, "listing"), eq(events.entityId, listingId)),
        relatedCaseIds.length > 0
          ? and(
              eq(events.entityType, "moderation_case"),
              inArray(events.entityId, relatedCaseIds),
              eq(events.eventType, "admin_moderation_enforcement")
            )
          : undefined
      )
    )
    .orderBy(desc(events.createdAt))
    .limit(50);

  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    createdAt: row.createdAt.toISOString(),
    actor: row.actorProfileId
      ? {
          id: row.actorProfileId,
          displayName: row.actorDisplayName
        }
      : null,
    metadata: sanitizeListingAuditMetadata(row.metadata)
  }));
}

function mapImage(row: {
  id: string;
  url: string;
  sortOrder: number;
  reviewStatus: "approved" | "rejected";
  reviewedAt: Date | null;
  reviewedByProfileId: string | null;
  createdAt: Date;
}): AdminListingImageReview {
  return {
    id: row.id,
    url: row.url,
    sortOrder: row.sortOrder,
    reviewStatus: row.reviewStatus,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedByProfileId: row.reviewedByProfileId,
    createdAt: row.createdAt.toISOString()
  };
}

function getAdminListingOrderBy(sort: AdminListingSort | undefined) {
  switch (sort) {
    case "oldest":
      return asc(listings.createdAt);
    case "updated_desc":
      return desc(listings.updatedAt);
    case "updated_asc":
      return asc(listings.updatedAt);
    case "newest":
    default:
      return desc(listings.createdAt);
  }
}

function getActionEligibility(status: string): AdminListingActionEligibility {
  return {
    canArchive: status !== "archived",
    canRestore: status === "archived",
    supportedActions: status === "archived" ? ["restore"] : ["archive"]
  };
}

function getNextStatusForAction(action: AdminListingActionValue): "active" | "archived" | null {
  switch (action) {
    case "archive":
      return "archived";
    case "restore":
      return "active";
  }
}

function getNextReviewStatusForAction(
  action: AdminListingImageActionValue
): "approved" | "rejected" | null {
  switch (action) {
    case "approve":
      return "approved";
    case "reject":
      return "rejected";
  }
}

function sanitizeListingAuditMetadata(
  metadata: Record<string, unknown>
): Record<string, string | number | boolean | string[] | null> {
  const allowedKeys = [
    "action",
    "enforcementAction",
    "imageId",
    "listingId",
    "moderationActionId",
    "nextStatus",
    "nextReviewStatus",
    "previousStatus",
    "previousReviewStatus",
    "reasonLength",
    "result",
    "resultingStatus",
    "targetId",
    "targetType"
  ];
  const safeMetadata: Record<string, string | number | boolean | string[] | null> = {};

  for (const key of allowedKeys) {
    const value = metadata[key];

    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      (Array.isArray(value) && value.every((item) => typeof item === "string"))
    ) {
      safeMetadata[key] = value;
    }
  }

  return safeMetadata;
}

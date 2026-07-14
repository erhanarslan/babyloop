import { randomBytes } from "node:crypto";
import type { Database } from "@babyloop/database";
import { listings, shortLinks } from "@babyloop/database/schema";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";

const SHORT_LINK_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHORT_LINK_CODE_LENGTH = 8;
const SHORT_LINK_MAX_CREATE_ATTEMPTS = 8;
const LISTING_SHARE_SOURCE = "listing_share";

export type ShortLinkPublicResponse = {
  code: string;
  url: string;
  targetPath: string;
};

export type GetOrCreateListingShareLinkResult =
  | {
      status: "ok";
      shareLink: ShortLinkPublicResponse;
    }
  | {
      status: "not_found";
    };

export type ResolveShortLinkResult =
  | {
      status: "ok";
      targetPath: string;
    }
  | {
      status: "not_found";
    };

export async function getOrCreateListingShareLink(
  db: Database,
  input: {
    listingId: string;
    webAppUrl: string;
    createdByProfileId?: string | null;
  }
): Promise<GetOrCreateListingShareLinkResult> {
  const listingId = input.listingId.trim();

  if (!listingId) {
    return { status: "not_found" };
  }

  const [listing] = await db
    .select({
      id: listings.id
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!listing) {
    return { status: "not_found" };
  }

  const existing = await findActiveListingShareLink(db, listing.id);

  if (existing) {
    return {
      status: "ok",
      shareLink: toShortLinkPublicResponse(existing, input.webAppUrl)
    };
  }

  const targetPath = buildListingTargetPath(listing.id);

  for (let attempt = 0; attempt < SHORT_LINK_MAX_CREATE_ATTEMPTS; attempt += 1) {
    const code = generateShortCode();

    try {
      const [created] = await db
        .insert(shortLinks)
        .values({
          code,
          targetType: "listing",
          targetId: listing.id,
          targetPath,
          createdByProfileId: input.createdByProfileId ?? null,
          source: LISTING_SHARE_SOURCE
        })
        .returning({
          code: shortLinks.code,
          targetPath: shortLinks.targetPath
        });

      if (!created) {
        continue;
      }

      return {
        status: "ok",
        shareLink: toShortLinkPublicResponse(created, input.webAppUrl)
      };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const reused = await findActiveListingShareLink(db, listing.id);

      if (reused) {
        return {
          status: "ok",
          shareLink: toShortLinkPublicResponse(reused, input.webAppUrl)
        };
      }
    }
  }

  throw new Error("Short link code generation exhausted.");
}

export async function resolveShortLink(
  db: Database,
  code: string
): Promise<ResolveShortLinkResult> {
  const normalizedCode = code.trim();

  if (!isShortCode(normalizedCode)) {
    return { status: "not_found" };
  }

  const now = new Date();

  const [link] = await db
    .select({
      id: shortLinks.id,
      targetPath: shortLinks.targetPath
    })
    .from(shortLinks)
    .where(
      and(
        eq(shortLinks.code, normalizedCode),
        eq(shortLinks.isActive, true),
        or(isNull(shortLinks.expiresAt), gt(shortLinks.expiresAt, now))
      )
    )
    .limit(1);

  if (!link) {
    return { status: "not_found" };
  }

  await db
    .update(shortLinks)
    .set({
      clickCount: sql`${shortLinks.clickCount} + 1`,
      updatedAt: now
    })
    .where(eq(shortLinks.id, link.id));

  return {
    status: "ok",
    targetPath: link.targetPath
  };
}

export function buildListingTargetPath(listingId: string): string {
  return `/listings/${encodeURIComponent(listingId)}`;
}

export function buildShortLinkUrl(webAppUrl: string, code: string): string {
  return `${normalizeWebAppUrl(webAppUrl)}/s/${encodeURIComponent(code)}`;
}

export function normalizeWebAppUrl(webAppUrl: string): string {
  const trimmed = webAppUrl.trim().replace(/\/+$/u, "");

  if (!trimmed) {
    return "http://localhost:3000";
  }

  try {
    const parsedUrl = new URL(trimmed);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return "http://localhost:3000";
    }

    parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/u, "");
    parsedUrl.search = "";
    parsedUrl.hash = "";

    return parsedUrl.toString().replace(/\/+$/u, "");
  } catch {
    return "http://localhost:3000";
  }
}


export function buildDirectListingShareLink(
  listingId: string,
  webAppUrl: string
): ShortLinkPublicResponse {
  const targetPath = buildListingTargetPath(listingId);

  return {
    code: "",
    url: `${normalizeWebAppUrl(webAppUrl)}${targetPath}`,
    targetPath
  };
}

export function isMissingShortLinksTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "42P01" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string" &&
    (error as { message: string }).message.includes("short_links")
  );
}

export function generateShortCode(): string {
  const bytes = randomBytes(SHORT_LINK_CODE_LENGTH);
  let code = "";

  for (const byte of bytes) {
    code += SHORT_LINK_ALPHABET[byte % SHORT_LINK_ALPHABET.length];
  }

  return code;
}

export function isShortCode(value: string): boolean {
  return /^[0-9A-Za-z]{6,12}$/u.test(value);
}

async function findActiveListingShareLink(
  db: Database,
  listingId: string
): Promise<{ code: string; targetPath: string } | null> {
  const [existing] = await db
    .select({
      code: shortLinks.code,
      targetPath: shortLinks.targetPath
    })
    .from(shortLinks)
    .where(
      and(
        eq(shortLinks.targetType, "listing"),
        eq(shortLinks.targetId, listingId),
        eq(shortLinks.source, LISTING_SHARE_SOURCE),
        eq(shortLinks.isActive, true),
        isNull(shortLinks.expiresAt)
      )
    )
    .limit(1);

  return existing ?? null;
}

function toShortLinkPublicResponse(
  link: {
    code: string;
    targetPath: string;
  },
  webAppUrl: string
): ShortLinkPublicResponse {
  return {
    code: link.code,
    url: buildShortLinkUrl(webAppUrl, link.code),
    targetPath: link.targetPath
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

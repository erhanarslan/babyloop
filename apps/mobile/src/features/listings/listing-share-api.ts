import { apiGet, isRecord } from "../../api/client";
import { getApiBaseUrl } from "../../config/api";

export type MobileListingShareLink = {
  code: string;
  targetPath: string;
  url: string;
};

export async function fetchMobileListingShareLink(
  listingId: string
): Promise<MobileListingShareLink> {
  const fallback = buildMobileListingFallbackShareLink(listingId);

  const result = await apiGet<unknown>(
    `/api/v1/listings/${encodeURIComponent(listingId)}/share-link`
  );

  if (!result.ok) {
    return fallback;
  }

  try {
    return normalizeMobileListingShareLink(result.data);
  } catch {
    return fallback;
  }
}

export function buildMobileListingFallbackShareLink(
  listingId: string,
  apiBaseUrl = getApiBaseUrl()
): MobileListingShareLink {
  const targetPath = `/listings/${encodeURIComponent(listingId)}`;

  return {
    code: "",
    targetPath,
    url: `${deriveWebBaseUrlFromApiBaseUrl(apiBaseUrl)}${targetPath}`
  };
}

export function deriveWebBaseUrlFromApiBaseUrl(apiBaseUrl: string): string {
  try {
    const parsedUrl = new URL(apiBaseUrl);

    if (parsedUrl.port === "4000") {
      parsedUrl.port = "3000";
    }

    parsedUrl.pathname = "";
    parsedUrl.search = "";
    parsedUrl.hash = "";

    return parsedUrl.toString().replace(/\/+$/u, "");
  } catch {
    return "http://localhost:3000";
  }
}

function normalizeMobileListingShareLink(payload: unknown): MobileListingShareLink {
  const shareLink = isRecord(payload) && isRecord(payload.shareLink)
    ? payload.shareLink
    : isRecord(payload) && isRecord(payload.data) && isRecord(payload.data.shareLink)
      ? payload.data.shareLink
      : null;

  if (!shareLink) {
    throw new Error("Paylaşım bağlantısı alınamadı.");
  }

  const code = pickString(shareLink, "code") ?? "";
  const url = pickString(shareLink, "url");
  const targetPath = pickString(shareLink, "targetPath");

  if (!url || !targetPath) {
    throw new Error("Paylaşım bağlantısı eksik döndü.");
  }

  return {
    code,
    targetPath,
    url
  };
}

function pickString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

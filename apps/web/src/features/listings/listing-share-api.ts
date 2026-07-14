export type WebListingShareLink = {
  code: string;
  targetPath: string;
  url: string;
};

export async function fetchWebListingShareLink(
  apiBaseUrl: string,
  listingId: string
): Promise<WebListingShareLink> {
  const response = await fetch(
    `${apiBaseUrl}/api/v1/listings/${encodeURIComponent(listingId)}/share-link`,
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("Share link request failed.");
  }

  const payload: unknown = await response.json().catch(() => null);
  const shareLink = extractShareLink(payload);

  if (!shareLink) {
    throw new Error("Share link payload is invalid.");
  }

  return shareLink;
}

function extractShareLink(payload: unknown): WebListingShareLink | null {
  if (!isRecord(payload)) {
    return null;
  }

  const source = isRecord(payload.data) && isRecord(payload.data.shareLink)
    ? payload.data.shareLink
    : isRecord(payload.shareLink)
      ? payload.shareLink
      : null;

  if (!source) {
    return null;
  }

  const code = pickString(source, "code") ?? "";
  const targetPath = pickString(source, "targetPath");
  const url = pickString(source, "url");

  if (!targetPath || !url) {
    return null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

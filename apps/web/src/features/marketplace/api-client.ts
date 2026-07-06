export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code?: string; message?: string } };

export class MarketplaceApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, options: { status: number; code?: string | undefined }) {
    super(message);
    this.name = "MarketplaceApiError";
    this.status = options.status;
    this.code = options.code;
  }
}

export function getMarketplaceApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return configured && configured.length > 0 ? configured.replace(/\/$/, "") : "http://localhost:4000";
}

export async function marketplaceJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getMarketplaceApiBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers
    }
  });

  const payload = (await response.json().catch(() => null)) as ApiResult<T> | null;

  if (!response.ok || !payload?.ok) {
    const message =
      payload && "error" in payload
        ? payload.error.message ?? payload.error.code ?? "Request failed."
        : "Request failed.";
    const code = payload && "error" in payload ? payload.error.code : undefined;
    throw new MarketplaceApiError(message, code === undefined ? { status: response.status } : { status: response.status, code });
  }

  return payload.data;
}

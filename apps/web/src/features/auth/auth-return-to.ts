const AUTH_RETURN_TO_STORAGE_KEY = "babyloop_auth_return_to";

export function storeAuthReturnTo(returnTo: string): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(AUTH_RETURN_TO_STORAGE_KEY, returnTo);
  }
}

export function getStoredAuthReturnTo(fallback = "/"): string {
  if (typeof window === "undefined") {
    return fallback;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const queryReturnTo = sanitizeReturnTo(searchParams.get("returnTo"));

  if (queryReturnTo) {
    storeAuthReturnTo(queryReturnTo);
    return queryReturnTo;
  }

  return sanitizeReturnTo(sessionStorage.getItem(AUTH_RETURN_TO_STORAGE_KEY)) ?? fallback;
}

export function clearStoredAuthReturnTo(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(AUTH_RETURN_TO_STORAGE_KEY);
  }
}

function sanitizeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

export const AUTH_TOKEN_STORAGE_KEY = "babyloop_access_token";
export const AUTH_CHANGED_EVENT = "babyloop-auth-changed";

export type AuthMe = {
  user: {
    id: string;
    email: string;
    role: string;
  };
  profile: {
    id: string;
    displayName: string;
    locationCity: string | null;
  };
};

export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage?.getItem(AUTH_TOKEN_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    window.localStorage?.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } catch {
    return;
  }

  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearAuthToken(): void {
  try {
    window.localStorage?.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return;
  }

  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function authHeader(): HeadersInit {
  const token = getAuthToken();

  return token ? { authorization: `Bearer ${token}` } : {};
}

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

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string): void {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearAuthToken(): void {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function authHeader(): HeadersInit {
  const token = getAuthToken();

  return token ? { authorization: `Bearer ${token}` } : {};
}

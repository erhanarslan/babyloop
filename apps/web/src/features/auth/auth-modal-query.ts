import type { AuthMode } from "./api";

export type AuthModalErrorCode =
  | "google_auth_failed"
  | "google_auth_unavailable"
  | "legal_terms_required";

export type AuthModalQuery = {
  errorCode: AuthModalErrorCode | null;
  mode: AuthMode;
  passwordChanged: boolean;
  provider: "google" | null;
  returnTo: string | null;
};

const AUTH_MODAL_ERROR_MESSAGES: Record<AuthModalErrorCode, string> = {
  google_auth_failed: "Google ile giriş başarısız oldu. Lütfen tekrar deneyin.",
  google_auth_unavailable:
    "Google ile giriş şu anda kullanılamıyor. E-posta ve şifreyle devam edebilirsin.",
  legal_terms_required:
    "Bu Google hesabıyla ilk kez devam ediyorsun. Kullanım Koşulları'nı kabul edip Google ile devam et."
};

const AUTH_MODAL_QUERY_KEYS = [
  "auth",
  "authError",
  "error",
  "passwordChanged",
  "provider",
  "returnTo"
] as const;

export function readAuthModalQuery(searchParams: URLSearchParams): AuthModalQuery | null {
  const mode = readAuthMode(searchParams.get("auth"));

  if (!mode) {
    return null;
  }

  const provider = searchParams.get("provider") === "google" ? "google" : null;
  const requestedError = readAuthModalErrorCode(searchParams.get("authError"));
  const errorCode = requestedError === "legal_terms_required" && provider !== "google"
    ? null
    : requestedError;

  return {
    errorCode,
    mode: errorCode === "legal_terms_required" ? "register" : mode,
    passwordChanged: mode === "login" && searchParams.get("passwordChanged") === "1",
    provider,
    returnTo: normalizeAuthReturnTo(searchParams.get("returnTo"))
  };
}

export function getAuthModalErrorMessage(errorCode: AuthModalErrorCode | null): string | null {
  return errorCode ? AUTH_MODAL_ERROR_MESSAGES[errorCode] : null;
}

export function buildLegacyAuthRedirect(
  defaultMode: AuthMode,
  incoming: Record<string, string | string[] | undefined> | undefined
): string {
  const legacyError = readAuthModalErrorCode(readFirstValue(incoming?.authError))
    ?? readAuthModalErrorCode(readFirstValue(incoming?.error));
  const mode = legacyError === "legal_terms_required" ? "register" : defaultMode;
  const returnTo = normalizeAuthReturnTo(readFirstValue(incoming?.returnTo));
  const params = new URLSearchParams({ auth: mode });

  if (legacyError) {
    params.set("authError", legacyError);
  }

  if (legacyError === "legal_terms_required") {
    params.set("provider", "google");
  }

  if (mode === "login" && readFirstValue(incoming?.passwordChanged) === "1") {
    params.set("passwordChanged", "1");
  }

  if (returnTo) {
    params.set("returnTo", returnTo);
  }

  return `/?${params.toString()}`;
}

export function removeAuthModalQuery(searchParams: URLSearchParams): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);

  for (const key of AUTH_MODAL_QUERY_KEYS) {
    nextSearchParams.delete(key);
  }

  return nextSearchParams;
}

export function normalizeAuthReturnTo(value: string | null): string | null {
  if (
    !value
    || !value.startsWith("/")
    || value.startsWith("//")
    || value.startsWith("/login")
    || value.startsWith("/register")
  ) {
    return null;
  }

  return value;
}

function readAuthMode(value: string | null): AuthMode | null {
  return value === "login" || value === "register" ? value : null;
}

function readAuthModalErrorCode(value: string | null | undefined): AuthModalErrorCode | null {
  switch (value) {
    case "google_auth_failed":
    case "google_auth_unavailable":
    case "legal_terms_required":
      return value;
    default:
      return null;
  }
}

function readFirstValue(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

type ResponseWithHeaders = {
  headers: Record<string, string | string[] | undefined>;
};

export function getRefreshSetCookie(response: ResponseWithHeaders): string {
  const refreshCookie = getSetCookieHeaders(response).find((header) =>
    header.startsWith("babyloop_refresh_token=")
  );

  if (!refreshCookie) {
    throw new Error("Refresh cookie was not set.");
  }

  return refreshCookie;
}

export function getGoogleOAuthStateSetCookie(response: ResponseWithHeaders): string {
  const stateCookie = getSetCookieHeaders(response).find((header) =>
    header.startsWith("babyloop_google_oauth_state=")
  );

  if (!stateCookie) {
    throw new Error("Google OAuth state cookie was not set.");
  }

  return stateCookie;
}

export function getSetCookieHeaders(response: ResponseWithHeaders): string[] {
  const setCookie = response.headers["set-cookie"];

  if (!setCookie) {
    return [];
  }

  return Array.isArray(setCookie) ? setCookie : [setCookie];
}

export function toCookieHeader(setCookieHeader: string): string {
  return setCookieHeader.split(";")[0] ?? setCookieHeader;
}

export function getCookieValue(setCookieHeader: string): string {
  const cookiePair = toCookieHeader(setCookieHeader);
  const separatorIndex = cookiePair.indexOf("=");

  if (separatorIndex === -1) {
    return "";
  }

  return cookiePair.slice(separatorIndex + 1);
}

export function getDevResetToken(response: { json: () => unknown }): string {
  const body = response.json() as {
    data?: {
      devResetToken?: string;
    };
  };

  if (!body.data?.devResetToken) {
    throw new Error("Expected dev reset token in test response.");
  }

  return body.data.devResetToken;
}

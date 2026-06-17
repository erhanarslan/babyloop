export const protectedRoutePrefixes = [
  "/sell",
  "/favorites",
  "/messages",
  "/conversations",
  "/inbox",
  "/notifications",
  "/my-listings",
  "/account",
  "/saved-searches",
  "/children",
  "/child",
  "/child-profiles",
  "/assistant"
];

export const authPromptRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/auth/verify-email/request"
];

export function isProtectedHref(href: string): boolean {
  if (!href.startsWith("/")) {
    return false;
  }

  return protectedRoutePrefixes.some(
    (prefix) => href === prefix || href.startsWith(`${prefix}/`)
  );
}

export function isAuthPromptHref(href: string): boolean {
  if (!href.startsWith("/")) {
    return false;
  }

  return authPromptRoutes.some(
    (route) => href === route || href.startsWith(`${route}?`)
  );
}

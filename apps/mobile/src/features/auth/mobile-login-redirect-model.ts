export type MobileLoginRedirectParams = {
  postLoginAction?: string | string[];
  redirectTo?: string | string[];
};

export function buildMobilePostLoginRedirectPath(params: MobileLoginRedirectParams): string {
  const redirectTo = firstParam(params.redirectTo);
  const postLoginAction = firstParam(params.postLoginAction);

  if (!redirectTo || !isAllowedMobileRedirectPath(redirectTo)) {
    return "/account";
  }

  if (!postLoginAction) {
    return redirectTo;
  }

  const separator = redirectTo.includes("?") ? "&" : "?";

  return `${redirectTo}${separator}postLoginAction=${encodeURIComponent(postLoginAction)}`;
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return value?.trim() || null;
}

function isAllowedMobileRedirectPath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return false;
  }

  return (
    value === "/" ||
    value === "/favorites" ||
    value === "/messages" ||
    value === "/account" ||
    value === "/basket" ||
    value === "/sell" ||
    value.startsWith("/listing/") ||
    value.startsWith("/conversation/")
  );
}

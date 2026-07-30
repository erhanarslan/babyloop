export function resolveSafeBackofficeNextPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const decoded = decodeURIComponent(value);

    if (!decoded.startsWith("/") || decoded.startsWith("//")) {
      return fallback;
    }

    const parsed = new URL(decoded, "https://admin.babyloop.invalid");

    if (parsed.origin !== "https://admin.babyloop.invalid") {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

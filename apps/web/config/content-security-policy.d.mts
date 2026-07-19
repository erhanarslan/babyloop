export function buildContentSecurityPolicy(input: {
  apiBaseUrl?: string;
  nodeEnv?: string;
}): string;

export function resolveConfiguredApiOrigins(
  apiBaseUrl: string | undefined,
  options?: { allowInsecure?: boolean }
): string[];

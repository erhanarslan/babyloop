export function getBackofficeBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BACKOFFICE_BASE_URL ?? "http://localhost:3001";
}

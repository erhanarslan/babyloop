export const LEGAL_DOCUMENT_VERSIONS = {
  aiNotice: "2026-07-20",
  cookies: "2026-07-20",
  dataDeletion: "2026-07-20",
  kvkkNotice: "2026-07-20",
  marketplace: "2026-07-20",
  privacy: "2026-07-20",
  terms: "2026-07-20"
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENT_VERSIONS;

export const CURRENT_TERMS_VERSION = LEGAL_DOCUMENT_VERSIONS.terms;

export const LEGAL_ACCEPTANCE_DOCUMENT_TYPES = ["terms"] as const;
export type LegalAcceptanceDocumentType = typeof LEGAL_ACCEPTANCE_DOCUMENT_TYPES[number];

export const LEGAL_ACCEPTANCE_SOURCES = [
  "web_password",
  "mobile_password",
  "google_oauth"
] as const;
export type LegalAcceptanceSource = typeof LEGAL_ACCEPTANCE_SOURCES[number];

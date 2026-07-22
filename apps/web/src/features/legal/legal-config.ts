export type LegalReleaseMode = "non_commercial_beta" | "commercial_public";

export type LegalOperatorConfig = {
  address: string;
  commercialActivityEnabled: boolean;
  configured: boolean;
  contactEmail: string;
  operatorName: string;
  publicLocation: string;
  releaseMode: LegalReleaseMode;
};

const PLACEHOLDER_OPERATOR = "BabyLoop veri sorumlusu yapılandırılmadı";
const PLACEHOLDER_EMAIL = "legal-contact-not-configured@invalid.local";
const PLACEHOLDER_LOCATION = "Kamuya açık konum yapılandırılmadı";

const LEGAL_RELEASE_MODES = new Set<LegalReleaseMode>([
  "non_commercial_beta",
  "commercial_public"
]);

export function getLegalOperatorConfig(): LegalOperatorConfig {
  const operatorName = process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME?.trim() || PLACEHOLDER_OPERATOR;
  const contactEmail = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || PLACEHOLDER_EMAIL;
  const rawReleaseMode = process.env.NEXT_PUBLIC_LEGAL_RELEASE_MODE?.trim() || "";
  const releaseMode: LegalReleaseMode = LEGAL_RELEASE_MODES.has(rawReleaseMode as LegalReleaseMode)
    ? (rawReleaseMode as LegalReleaseMode)
    : "non_commercial_beta";
  const rawCommercialActivity = process.env.NEXT_PUBLIC_LEGAL_COMMERCIAL_ACTIVITY_ENABLED?.trim() || "";
  const commercialActivityEnabled = rawCommercialActivity === "true";
  const publicLocation =
    process.env.NEXT_PUBLIC_LEGAL_PUBLIC_LOCATION?.trim() || PLACEHOLDER_LOCATION;
  const contactAddress = process.env.NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS?.trim() || "";

  const releaseModeConfigured = LEGAL_RELEASE_MODES.has(rawReleaseMode as LegalReleaseMode);
  const commercialFlagConfigured = rawCommercialActivity === "true" || rawCommercialActivity === "false";
  const address = commercialActivityEnabled ? contactAddress : publicLocation;
  const configured =
    operatorName !== PLACEHOLDER_OPERATOR &&
    contactEmail !== PLACEHOLDER_EMAIL &&
    publicLocation !== PLACEHOLDER_LOCATION &&
    releaseModeConfigured &&
    commercialFlagConfigured &&
    (!commercialActivityEnabled || contactAddress.length >= 12);

  return {
    address,
    commercialActivityEnabled,
    configured,
    contactEmail,
    operatorName,
    publicLocation,
    releaseMode
  };
}

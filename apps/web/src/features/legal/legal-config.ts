export type LegalOperatorConfig = {
  address: string;
  configured: boolean;
  contactEmail: string;
  operatorName: string;
};

const PLACEHOLDER_OPERATOR = "BabyLoop veri sorumlusu yapılandırılmadı";
const PLACEHOLDER_EMAIL = "legal-contact-not-configured@invalid.local";
const PLACEHOLDER_ADDRESS = "Yayın öncesinde gerçek tebligat/iletişim adresi yapılandırılmalıdır.";

export function getLegalOperatorConfig(): LegalOperatorConfig {
  const operatorName = process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME?.trim() || PLACEHOLDER_OPERATOR;
  const contactEmail = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || PLACEHOLDER_EMAIL;
  const address = process.env.NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS?.trim() || PLACEHOLDER_ADDRESS;
  const configured =
    operatorName !== PLACEHOLDER_OPERATOR &&
    contactEmail !== PLACEHOLDER_EMAIL &&
    address !== PLACEHOLDER_ADDRESS;

  return { address, configured, contactEmail, operatorName };
}

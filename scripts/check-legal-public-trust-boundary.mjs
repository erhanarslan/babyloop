import { existsSync, readFileSync } from "node:fs";

const problems = [];
const requiredFiles = [
  "packages/shared/src/legal.ts",
  "packages/database/drizzle/0044_legal_public_trust.sql",
  "apps/api/src/schemas/auth.schemas.ts",
  "apps/api/src/services/auth.service.ts",
  "apps/api/src/services/google-oauth.service.ts",
  "apps/web/src/features/legal/legal-documents.ts",
  "apps/web/src/features/legal/legal-consent.tsx",
  "apps/web/src/features/auth/auth-form.tsx",
  "apps/mobile/src/features/auth/register-screen.tsx",
  "apps/mobile/src/features/legal/legal-screen.tsx",
  "docs/84-legal-kvkk-consent-public-trust.md"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) problems.push(`Missing legal/public-trust file: ${file}`);
}

function read(file) {
  return readFileSync(file, "utf8");
}

function mustContain(file, token) {
  const source = read(file);
  if (!source.includes(token)) problems.push(`${file} must contain ${JSON.stringify(token)}.`);
}

function mustNotMatch(file, pattern, label) {
  if (pattern.test(read(file))) problems.push(`${file} must not ${label}.`);
}

if (problems.length === 0) {
  for (const token of [
    "CURRENT_TERMS_VERSION",
    "LEGAL_DOCUMENT_VERSIONS",
    '"google_oauth"',
    '"mobile_password"',
    '"web_password"'
  ]) mustContain("packages/shared/src/legal.ts", token);

  for (const token of [
    'CREATE TABLE IF NOT EXISTS "legal_acceptances"',
    '"document_version"',
    '"source"',
    "legal_acceptances_user_document_version_unique"
  ]) mustContain("packages/database/drizzle/0044_legal_public_trust.sql", token);

  for (const token of ["termsAccepted: z.literal(true)", "CURRENT_TERMS_VERSION"])
    mustContain("apps/api/src/schemas/auth.schemas.ts", token);

  for (const token of [
    "tx.insert(legalAcceptances)",
    "GoogleLegalTermsRequiredError",
    'source: options.legalAcceptanceSource'
  ]) mustContain("apps/api/src/services/auth.service.ts", token);

  for (const token of [
    "GOOGLE_OAUTH_TERMS_COOKIE_NAME",
    "serializeGoogleOAuthTermsCookie",
    "readGoogleOAuthTermsCookie",
    "HttpOnly",
    "SameSite=Lax"
  ]) mustContain("apps/api/src/services/google-oauth.service.ts", token);

  for (const token of [
    "KVKK Aydınlatma Metni",
    "Gizlilik Politikası",
    "Kullanım Koşulları",
    "Çerez ve Yerel Depolama Politikası",
    "Yapay Zekâ ve Asistan Bildirimi",
    "Hesap ve Veri Silme Politikası",
    "çocukların bağımsız kullanımına yönelik değildir",
    "gerçek para tahsilatı yapılmaz"
  ]) mustContain("apps/web/src/features/legal/legal-documents.ts", token);

  for (const token of [
    'useState<AnalyticsConsent>("unset")',
    'analyticsConsent === "accepted"',
    "İsteğe bağlıları reddet",
    "Analitiğe izin ver"
  ]) mustContain("apps/web/src/features/legal/legal-consent.tsx", token);

  for (const token of [
    "Bu bilgilendirme açık rıza talebi değildir.",
    'name="termsAccepted"',
    "buildAuthPayload(new FormData(event.currentTarget), isRegister, termsAccepted)",
    "!displayName || !termsAccepted"
  ]) mustContain("apps/web/src/features/auth/auth-form.tsx", token);

  mustNotMatch(
    "apps/web/src/features/auth/auth-form.tsx",
    /KVKK[^\n]{0,120}(kabul ediyorum|onay veriyorum)/iu,
    "combine KVKK notice with a consent checkbox"
  );

  for (const token of [
    "window.localStorage.removeItem(ANONYMOUS_ID_KEY)",
    "window.sessionStorage.removeItem(SESSION_STATE_KEY)",
    "if (!analyticsEnabled)"
  ]) mustContain("apps/web/src/features/analytics/analytics-provider.tsx", token);

  for (const token of [
    "if (!termsAccepted)",
    "termsAccepted: true",
    "termsVersion: CURRENT_TERMS_VERSION",
    'accessibilityRole="checkbox"'
  ]) mustContain("apps/mobile/src/features/auth/register-screen.tsx", token);

  for (const token of [
    "packages/shared/src/legal.ts",
    'jest.requireActual("node:fs")',
    'jest.requireActual("node:path")'
  ]) {
    const file = token.startsWith("packages/")
      ? "apps/mobile/jest.config.js"
      : "apps/mobile/src/features/legal/legal-public-trust-contract.test.ts";
    mustContain(file, token);
  }

  mustNotMatch(
    "apps/mobile/src/features/legal/legal-public-trust-contract.test.ts",
    /from\s+["']node:(?:fs|path)["']/u,
    "import Node built-ins through TypeScript module resolution"
  );

  for (const token of [
    "NEXT_PUBLIC_LEGAL_OPERATOR_NAME",
    "NEXT_PUBLIC_LEGAL_CONTACT_EMAIL",
    "NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS",
    "EXPO_PUBLIC_WEB_BASE_URL",
    "checkLegalPublicTrustEnv"
  ]) mustContain("scripts/check-deployment-readiness.mjs", token);

  for (const file of ["apps/api/vitest.config.ts", "apps/web/vitest.config.ts"]) {
    mustContain(
      file,
      '"@babyloop/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url))'
    );
  }

  for (const token of [
    "pnpm --filter @babyloop/shared build && pnpm --filter @babyloop/api exec vitest",
    "pnpm --filter @babyloop/shared build && pnpm --filter @babyloop/web exec vitest"
  ]) mustContain("package.json", token);

  for (const token of [
    "aydınlatma ve açık rıza ayrımı",
    "opsiyonel analitik varsayılan kapalı",
    "hukuk uzmanı",
    "0044_legal_public_trust.sql"
  ]) mustContain("docs/84-legal-kvkk-consent-public-trust.md", token);
}

if (problems.length > 0) {
  console.error("Legal/KVKK public trust boundary guard failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log("Legal/KVKK public trust boundary guard passed.");

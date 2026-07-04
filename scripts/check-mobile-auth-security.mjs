import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "apps/mobile/src/features/auth/auth-token-storage.ts",
  "apps/mobile/src/features/auth/auth-api.ts",
  "apps/mobile/src/features/auth/auth-api.test.ts",
  "apps/mobile/src/features/auth/auth-session.tsx",
  "apps/mobile/src/features/auth/login-screen.tsx",
  "apps/mobile/src/features/security/security-model.ts",
  "apps/mobile/src/features/security/security-model.test.ts",
  "apps/mobile/src/features/security/mobile-session-model.ts",
  "apps/mobile/src/features/security/mobile-session-model.test.ts",
  "apps/mobile/src/features/security/mobile-login-approval-model.ts",
  "apps/mobile/src/features/security/mobile-login-approval-model.test.ts",
  "apps/mobile/src/features/messages/messages-realtime-model.test.ts",
  "apps/mobile/src/features/realtime/mobile-realtime.ts",
  "apps/mobile/package.json",
  "package.json",
  "docs/25-validation-and-regression-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/56-mobile-scope-freeze.md"
];

const problems = [];

function read(relativePath) {
  return readFileSync(`${process.cwd()}/${relativePath}`, "utf8");
}

function mustContain(source, file, token) {
  if (!source.includes(token)) {
    problems.push(`${file} must contain ${JSON.stringify(token)}.`);
  }
}

function mustContainCaseInsensitive(source, file, token) {
  if (!source.toLowerCase().includes(token.toLowerCase())) {
    problems.push(`${file} must contain ${JSON.stringify(token)}.`);
  }
}

function mustNotContain(source, file, token) {
  if (source.includes(token)) {
    problems.push(`${file} must not contain ${JSON.stringify(token)}.`);
  }
}

function mustContainAny(source, file, tokens, label) {
  if (!tokens.some((token) => source.includes(token))) {
    problems.push(`${file} must contain one of ${label}: ${tokens.map((token) => JSON.stringify(token)).join(", ")}.`);
  }
}

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required mobile auth security file: ${file}`);
  }
}

if (problems.length === 0) {
  checkSecureTokenStorage();
  checkMobileAuthApiBoundary();
  checkMobileAuthSessionBoundary();
  checkLoginOtpUiBoundary();
  checkSecuritySettingsBoundary();
  checkMobileSessionPrivacyBoundary();
  checkMobileLoginApprovalBoundary();
  checkMobileRealtimeBoundary();
  checkP0ScriptsAndDocs();
}

function checkSecureTokenStorage() {
  const file = "apps/mobile/src/features/auth/auth-token-storage.ts";
  const source = read(file);

  mustContain(source, file, "expo-secure-store");
  mustContain(source, file, "SecureStore.getItemAsync");
  mustContain(source, file, "SecureStore.setItemAsync");
  mustContain(source, file, "SecureStore.deleteItemAsync");
  mustContain(source, file, "SecureStore.isAvailableAsync");
  mustContain(source, file, "MOBILE_AUTH_TOKEN_STORAGE_KEY");
  mustContain(source, file, "babyloop.mobile.accessToken.v1");

  for (const forbidden of [
    "AsyncStorage",
    "@react-native-async-storage/async-storage",
    "localStorage",
    "sessionStorage",
    "refreshToken",
    "refresh_token"
  ]) {
    mustNotContain(source, file, forbidden);
  }
}

function checkMobileAuthApiBoundary() {
  const file = "apps/mobile/src/features/auth/auth-api.ts";
  const testFile = "apps/mobile/src/features/auth/auth-api.test.ts";

  const source = read(file);
  const tests = read(testFile);

  for (const token of [
    "setStoredMobileAuthToken",
    "clearStoredMobileAuthToken",
    "hydrateMobileAuthToken",
    "mobileAuthFetch",
    "refreshMobileSession",
    "logoutMobileSession",
    "submitMobileAuthRequest",
    "verifyMobileMfaLogin",
    "completeMobileLoginApproval",
    "fetchMobileMfaStatus",
    "enableMobileMfa",
    "disableMobileMfa",
    "fetchMobileLoginApprovalStatus",
    "enableMobileLoginApproval",
    "disableMobileLoginApproval",
    "fetchMobileLoginApprovals",
    "approveMobileLoginApproval",
    "denyMobileLoginApproval",
    "PUBLIC_CSRF_HEADER_NAME",
    "x-babyloop-csrf-token",
    "credentials: \"include\"",
    "authorization",
    "Bearer"
  ]) {
    mustContain(source, file, token);
  }

  for (const endpoint of [
    "/api/v1/auth/mfa/verify",
    "/api/v1/auth/mfa/status",
    "/api/v1/auth/mfa/enable",
    "/api/v1/auth/mfa/disable",
    "/api/v1/auth/login-approval/status",
    "/api/v1/auth/login-approval/enable",
    "/api/v1/auth/login-approval/disable",
    "/api/v1/auth/login-approvals",
    "/api/v1/auth/login-approval/complete",
    "/api/v1/auth/refresh",
    "/api/v1/auth/logout",
    "/api/v1/auth/csrf"
  ]) {
    mustContain(source, file, endpoint);
  }

  for (const forbidden of [
    "@react-native-async-storage/async-storage",
    "AsyncStorage.",
    "localStorage",
    "sessionStorage"
  ]) {
    mustNotContain(source, file, forbidden);
  }

  for (const token of [
    "keeps MFA challenge unauthenticated until OTP is verified",
    "MFA_CODE_INVALID",
    "stores the access token after mobile login approval completion",
    "reads and updates mobile login approval preferences through authenticated mobile requests",
    "fetchMobileMfaStatus(): safe GET, no CSRF bootstrap",
    "enableMobileMfa(): POST first asks for public CSRF",
    "disableMobileMfa(): reuses cached CSRF",
    "not.toMatch(/accessToken|refreshToken|passwordHash|currentPassword/iu",
    "not.toMatch(/refreshToken|passwordHash|currentPassword/iu"
  ]) {
    mustContain(tests, testFile, token);
  }

  mustContainAny(
    tests,
    testFile,
    ["mfaRequired: true", "mfaRequired"],
    "MFA-required challenge coverage"
  );
}

function checkMobileAuthSessionBoundary() {
  const file = "apps/mobile/src/features/auth/auth-session.tsx";
  const source = read(file);

  for (const token of [
    "mfa_required",
    "mfaChallenge",
    "verifyMfa",
    "cancelMfa",
    "refreshMobileSession",
    "logoutMobileSession",
    "disconnectMobileRealtimeSocket",
    "subscribeMobileRealtime",
    "handleUnexpectedMobileApprovalRequired"
  ]) {
    mustContain(source, file, token);
  }

  for (const forbidden of [
    "@react-native-async-storage/async-storage",
    "AsyncStorage.",
    "localStorage",
    "sessionStorage"
  ]) {
    mustNotContain(source, file, forbidden);
  }
}

function checkLoginOtpUiBoundary() {
  const file = "apps/mobile/src/features/auth/login-screen.tsx";
  const source = read(file);

  for (const token of [
    "OTP doğrulaması",
    "E-postana gönderilen 6 haneli kodu gir",
    "otpCode",
    "otpCode.length !== 6",
    "OTP kodunu doğrula",
    "authSession.verifyMfa",
    "authSession.cancelMfa",
    "SecureStore",
    "AsyncStorage"
  ]) {
    mustContain(source, file, token);
  }
}

function checkSecuritySettingsBoundary() {
  const modelFile = "apps/mobile/src/features/security/security-model.ts";
  const testFile = "apps/mobile/src/features/security/security-model.test.ts";

  const model = read(modelFile);
  const tests = read(testFile);

  for (const token of [
    "mfaEnabled",
    "buildMfaRow",
    "MobileSensitiveSecurityToggleTarget",
    "mfa_email_otp",
    "mobile_login_approval",
    "buildMobileSensitiveToggleTitle",
    "buildMobileSensitiveToggleDescription",
    "canSubmitMobileSensitiveTogglePassword"
  ]) {
    mustContain(model, modelFile, token);
  }

  for (const token of [
    "E-posta OTP ayarını değiştir",
    "mevcut şifreni gir",
    "Mobil onay ayarını değiştir",
    "Web girişleri",
    "Password123!",
    "requires a strong enough current password before submitting sensitive toggles"
  ]) {
    mustContain(tests, testFile, token);
  }
}

function checkMobileSessionPrivacyBoundary() {
  const modelFile = "apps/mobile/src/features/security/mobile-session-model.ts";
  const testFile = "apps/mobile/src/features/security/mobile-session-model.test.ts";

  const model = read(modelFile);
  const tests = read(testFile);

  for (const token of [
    "safeSessionText",
    "buildMobileSessionCards",
    "getMobileSessionSummary",
    "currentDeviceLabel",
    "isCurrentSession"
  ]) {
    mustContain(model, modelFile, token);
  }

  for (const token of [
    "accessToken=secret-token",
    "not.toMatch(/secret-token|refreshToken|passwordHash/iu",
    "Bu cihaz eşleşmedi"
  ]) {
    mustContain(tests, testFile, token);
  }

  for (const forbidden of [
    "accessToken:",
    "refreshToken:",
    "passwordHash:"
  ]) {
    mustNotContain(model, modelFile, forbidden);
  }
}

function checkMobileLoginApprovalBoundary() {
  const modelFile = "apps/mobile/src/features/security/mobile-login-approval-model.ts";
  const testFile = "apps/mobile/src/features/security/mobile-login-approval-model.test.ts";

  const model = read(modelFile);
  const tests = read(testFile);

  for (const token of [
    "buildMobileLoginApprovalCards",
    "getMobileLoginApprovalSummary",
    "pending",
  ]) {
    mustContain(model, modelFile, token);
  }

  for (const token of [
    "MobileLoginApprovalChallenge",
    "approval-1",
    "Mac tarayıcı",
    "pending"
  ]) {
    mustContain(tests, testFile, token);
  }

  for (const statusToken of ["approved", "denied", "expired"]) {
    if (!tests.includes(statusToken) && !model.includes(statusToken)) {
      problems.push(`${testFile} or ${modelFile} must cover login approval status ${JSON.stringify(statusToken)}.`);
    }
  }

  for (const forbidden of [
    "accessToken",
    "refreshToken",
    "passwordHash"
  ]) {
    mustNotContain(model, modelFile, forbidden);
  }
}

function checkMobileRealtimeBoundary() {
  const file = "apps/mobile/src/features/realtime/mobile-realtime.ts";
  const source = read(file);

  for (const token of [
    "loginApprovalCreated",
    "login_approval:created",
    "hydrateMobileAuthToken",
    "getMobileAuthToken",
    "auth:",
    "token",
    "disconnectMobileRealtimeSocket"
  ]) {
    mustContain(source, file, token);
  }

  for (const forbidden of [
    "localStorage",
    "sessionStorage",
    "@react-native-async-storage/async-storage"
  ]) {
    mustNotContain(source, file, forbidden);
  }
}

function checkP0ScriptsAndDocs() {
  const rootPackage = JSON.parse(read("package.json"));
  const mobilePackage = JSON.parse(read("apps/mobile/package.json"));

  const rootP0 = rootPackage.scripts?.["test:mobile:p0"] ?? "";
  const mobileP0 = mobilePackage.scripts?.["test:p0"] ?? "";

  for (const [file, script] of [
    ["package.json#test:mobile:p0", rootP0],
    ["apps/mobile/package.json#test:p0", mobileP0]
  ]) {
    for (const token of [
      "src/features/auth/auth-api.test.ts",
      "src/features/security/security-model.test.ts",
      "src/features/auth/auth-sessions-api.test.ts",
      "src/features/security/mobile-session-model.test.ts",
      "src/features/security/mobile-login-approval-model.test.ts",
      "src/features/messages/messages-realtime-model.test.ts"
    ]) {
      if (!script.includes(token)) {
        problems.push(`${file} must include ${token}.`);
      }
    }
  }

  const freeze = read("docs/56-mobile-scope-freeze.md");
  for (const token of [
    "secure token storage",
    "MFA/OTP flow",
    "mobile security settings",
    "auth session controls",
    "mobile login approval management",
    "no access token in AsyncStorage",
    "no refresh token in AsyncStorage",
    "mobile login must not require mobile approval for itself"
  ]) {
    mustContain(freeze, "docs/56-mobile-scope-freeze.md", token);
  }

  const checklist = read("docs/25-validation-and-regression-checklist.md");
  const smoke = read("docs/55-beta-critical-smoke-checklist.md");

  for (const token of [
    "Mobile OTP/MFA P0 boundary",
    "pnpm security:mobile-auth",
    "SecureStore",
    "MFA-required",
    "mobile approval is for web login approval"
  ]) {
    mustContainCaseInsensitive(checklist, "docs/25-validation-and-regression-checklist.md", token);
  }

  for (const token of [
    "Mobile OTP/MFA P0 boundary",
    "pnpm security:mobile-auth",
    "test:mobile:p0",
    "mobile login must not require mobile approval for itself"
  ]) {
    mustContainCaseInsensitive(smoke, "docs/55-beta-critical-smoke-checklist.md", token);
  }
}

if (problems.length > 0) {
  console.error("Mobile auth security guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Mobile auth security guard passed.");

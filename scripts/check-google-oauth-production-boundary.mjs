import { readFileSync } from "node:fs";

const files = {
  config: "apps/api/src/config/env.ts",
  readiness: "scripts/check-deployment-readiness.mjs",
  service: "apps/api/src/services/google-oauth.service.ts",
  test: "apps/api/test/google-oauth-production-hardening.test.ts"
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [
    key,
    readFileSync(file, "utf8")
  ])
);

const failures = [];

function mustContain(key, token) {
  if (!source[key].includes(token)) {
    failures.push(`${files[key]} missing ${token}`);
  }
}

mustContain("config", "Google OAuth configuration is partial");
mustContain("config", "/api/v1/auth/google/callback");
mustContain("config", "GOOGLE_REDIRECT_URI must use HTTPS in production");
mustContain("service", "GOOGLE_OAUTH_PROVIDER_TIMEOUT_MS");
mustContain("service", "AbortSignal.timeout");
mustContain("service", '"cache-control": "no-store"');
mustContain("service", 'pragma: "no-cache"');
mustContain("readiness", ".apps.googleusercontent.com");
mustContain("readiness", "must exactly match the deployed API callback");
mustContain("readiness", "WEB_APP_URL must match NEXT_PUBLIC_SITE_URL");
mustContain("test", "keeps access tokens out of errors");

if (failures.length > 0) {
  console.error("Google OAuth production boundary failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Google OAuth production boundary passed.");

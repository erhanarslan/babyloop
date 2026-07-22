import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { loadEnvFile } from "../deployment-lib.mjs";

const requiredExampleKeys = [
  "DEPLOY_ENVIRONMENT",
  "NODE_ENV",
  "DATABASE_URL",
  "AUTH_SECRET",
  "WEB_APP_URL",
  "CORS_ORIGINS",
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_BACKOFFICE_BASE_URL",
  "EXPO_PUBLIC_WEB_BASE_URL",
  "NEXT_PUBLIC_LEGAL_OPERATOR_NAME",
  "NEXT_PUBLIC_LEGAL_CONTACT_EMAIL",
  "NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS",
  "IMAGE_STORAGE_DRIVER",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "RAG_ENABLED",
  "RAG_QDRANT_URL",
  "RAG_REDIS_URL",
  "OBSERVABILITY_METRICS_ENABLED",
  "OBSERVABILITY_METRICS_TOKEN",
  "NOTIFICATION_PUSH_ENABLED",
  "PUSH_PROVIDER",
  "EXPO_ACCESS_TOKEN",
  "PUSH_TOKEN_ENCRYPTION_KEY",
  "RUNTIME_ENV_AUDIT_EVIDENCE_PATH",
  "PROVIDER_PROBE_EVIDENCE_PATH",
  "BACKUP_ENVIRONMENT",
  "BACKUP_ENCRYPTION_MODE",
  "BACKUP_AGE_RECIPIENT",
  "MIGRATION_ENVIRONMENT"
];

for (const target of ["staging", "production"]) {
  test(`${target} env example satisfies the deployment readiness contract after secret injection`, async () => {
    const loaded = await loadEnvFile(`deploy/env/${target}.env.example`);
    for (const key of requiredExampleKeys) {
      assert.ok(Object.hasOwn(loaded.values, key), `${target} example is missing ${key}`);
    }

    const fixture = {
      ...loaded.values,
      DATABASE_URL: `postgresql://user:password@db.babyloop.app:5432/babyloop_${target}?sslmode=require`,
      AUTH_SECRET: "a".repeat(48),
      NEXT_PUBLIC_LEGAL_OPERATOR_NAME: "BabyLoop Teknoloji",
      NEXT_PUBLIC_LEGAL_CONTACT_EMAIL: "legal@babyloop.app",
      NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS: "Ataşehir İstanbul Türkiye başvuru adresi",
      S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      S3_BUCKET: `babyloop-${target}`,
      S3_ACCESS_KEY_ID: "safe-fixture-access-key",
      S3_SECRET_ACCESS_KEY: "safe-fixture-secret-key",
      RAG_QDRANT_URL: "https://qdrant.babyloop.app",
      RAG_QDRANT_API_KEY: "safe-fixture-qdrant-key",
      RAG_REDIS_URL: "rediss://user:password@redis.babyloop.app:6380",
      GEMINI_API_KEY: "safe-fixture-gemini-key",
      OBSERVABILITY_METRICS_TOKEN: "m".repeat(48),
      OBSERVABILITY_ERROR_WEBHOOK_URL: "https://errors.babyloop.app/hook",
      BACKUP_AGE_RECIPIENT: `age1${"q".repeat(58)}`,
      EMAIL_FROM: "no-reply@babyloop.app",
      RESEND_API_KEY: "safe-fixture-resend-key",
      RESEND_FROM_EMAIL: "no-reply@babyloop.app",
      GOOGLE_CLIENT_ID: "1234567890-example.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "safe-fixture-google-secret",
      GOOGLE_REDIRECT_URI:
        target === "staging"
          ? "https://api.staging.babyloop.example/api/v1/auth/google/callback"
          : "https://api.babyloop.example/api/v1/auth/google/callback",
      EXPO_ACCESS_TOKEN: "safe-fixture-expo-token",
      PUSH_TOKEN_ENCRYPTION_KEY: "p".repeat(48),
      ...(target === "production"
        ? {
            RELEASE_BACKUP_MANIFEST_PATH: "/secure/backup.manifest.json",
            RELEASE_DATABASE_FORWARD_COMPATIBLE: "false"
          }
        : {})
    };

    const result = spawnSync(process.execPath, ["scripts/check-deployment-readiness.mjs", `--target=${target}`], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, ...fixture },
      shell: false
    });

    assert.equal(result.status, 0, `${target} readiness failed:\n${result.stdout}\n${result.stderr}`);
    assert.doesNotMatch(result.stdout, /❌/u);
  });
}

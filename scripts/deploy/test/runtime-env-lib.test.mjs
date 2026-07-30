import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  auditRuntimeEnv,
  loadRuntimeEnvContract,
  publicAuditView,
  redactEnvironment
} from "../runtime-env-lib.mjs";

const gitSha = "a".repeat(40);

test("audits a complete staging runtime env without exposing secret values", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-runtime-env-"));
  try {
    const envPath = join(directory, "staging.runtime.env");
    await writeFile(envPath, runtimeEnvFixture(), "utf8");
    await chmod(envPath, 0o600);

    const audit = await auditRuntimeEnv({ envFile: envPath, target: "staging" });
    assert.equal(audit.status, "passed");
    assert.ok(audit.configuredProviders.includes("s3-r2"));
    assert.ok(audit.configuredProviders.includes("push:expo"));
    assert.ok(audit.secretNames.includes("AUTH_SECRET"));

    const view = publicAuditView(audit, gitSha);
    assert.equal(view.gitSha, gitSha);
    assert.equal(JSON.stringify(view).includes("super-secret"), false);

    const { contract } = await loadRuntimeEnvContract();
    const redacted = redactEnvironment(audit.values, contract);
    assert.equal(redacted.AUTH_SECRET, "[REDACTED]");
    assert.equal(redacted.NEXT_PUBLIC_SITE_URL, "https://staging.babyloop.test");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects placeholder values and insecure runtime env permissions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-runtime-env-"));
  try {
    const envPath = join(directory, "staging.runtime.env");
    await writeFile(envPath, runtimeEnvFixture().replace(
      "Erhan Arslan",
      "REPLACE_WITH_OPERATOR_NAME"
    ), "utf8");
    await chmod(envPath, 0o644);

    await assert.rejects(
      () => auditRuntimeEnv({ envFile: envPath, target: "staging" }),
      /chmod 600|placeholder/u
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects mismatched public origins and local Redis transport", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-runtime-env-"));
  try {
    const envPath = join(directory, "staging.runtime.env");
    const content = runtimeEnvFixture()
      .replace(
        "CORS_ORIGINS=https://staging.babyloop.test,https://admin.staging.babyloop.test",
        "CORS_ORIGINS=https://staging.babyloop.test"
      )
      .replace(
        "RAG_REDIS_URL=rediss://user:password@redis.staging.babyloop.test:6380",
        "RAG_REDIS_URL=redis://localhost:6379"
      );
    await writeFile(envPath, content, "utf8");
    await chmod(envPath, 0o600);

    await assert.rejects(
      () => auditRuntimeEnv({ envFile: envPath, target: "staging" }),
      /CORS_ORIGINS must include|rediss/u
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects production documentation that is disabled or interactive", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-runtime-env-"));
  try {
    const envPath = join(directory, "staging.runtime.env");
    const content = runtimeEnvFixture()
      .replace("API_DOCS_ENABLED=true", "API_DOCS_ENABLED=false")
      .replace("API_DOCS_ACCESS_MODE=readonly", "API_DOCS_ACCESS_MODE=interactive");
    await writeFile(envPath, content, "utf8");
    await chmod(envPath, 0o600);
    await assert.rejects(
      () => auditRuntimeEnv({ envFile: envPath, target: "staging" }),
      /API_DOCS_ENABLED must be true|API_DOCS_ACCESS_MODE must be readonly/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function runtimeEnvFixture() {
  return [
    "DEPLOY_ENVIRONMENT=staging",
    "NODE_ENV=production",
    "DATABASE_URL=postgresql://user:password@db.staging.babyloop.test:5432/babyloop?sslmode=require",
    `AUTH_SECRET=${"s".repeat(48)}`,
    "ALLOW_AUTH_UNAVAILABLE=false",
    "API_DOCS_ENABLED=true",
    "API_DOCS_ACCESS_MODE=readonly",
    "WEB_APP_URL=https://staging.babyloop.test",
    "CORS_ORIGINS=https://staging.babyloop.test,https://admin.staging.babyloop.test",
    "NEXT_PUBLIC_API_BASE_URL=https://api.staging.babyloop.test",
    "BABYLOOP_API_BASE_URL=https://api.staging.babyloop.test",
    "NEXT_PUBLIC_SITE_URL=https://staging.babyloop.test",
    "BABYLOOP_SITE_URL=https://staging.babyloop.test",
    "NEXT_PUBLIC_BACKOFFICE_BASE_URL=https://admin.staging.babyloop.test",
    "EXPO_PUBLIC_WEB_BASE_URL=https://staging.babyloop.test",
    "NEXT_PUBLIC_LEGAL_OPERATOR_NAME=Erhan Arslan",
    "NEXT_PUBLIC_LEGAL_CONTACT_EMAIL=legal@babyloop.test",
    "NEXT_PUBLIC_LEGAL_RELEASE_MODE=non_commercial_beta",
    "NEXT_PUBLIC_LEGAL_COMMERCIAL_ACTIVITY_ENABLED=false",
    "NEXT_PUBLIC_LEGAL_PUBLIC_LOCATION=İstanbul, Türkiye",
    "IMAGE_STORAGE_DRIVER=s3",
    "IMAGE_STORAGE_PUBLIC_BASE_URL=https://cdn.staging.babyloop.test",
    "S3_ENDPOINT=https://account.r2.cloudflarestorage.com",
    "S3_REGION=auto",
    "S3_BUCKET=babyloop-staging",
    "S3_ACCESS_KEY_ID=staging-access-key",
    "S3_SECRET_ACCESS_KEY=staging-secret-key",
    "RAG_ENABLED=true",
    "RAG_VECTOR_STORE=qdrant",
    "RAG_QDRANT_URL=https://qdrant.staging.babyloop.test",
    "RAG_QDRANT_COLLECTION=babyloop_rag_active",
    "RAG_QDRANT_VECTOR_SIZE=3072",
    "RAG_EMBEDDING_PROVIDER=gemini",
    "RAG_EMBEDDING_MODEL=gemini-embedding-2",
    "RAG_CHAT_PROVIDER=gemini",
    "RAG_CHAT_MODEL=gemini-2.5-flash",
    "RAG_REQUIRE_SOURCES=true",
    "RAG_REDIS_ENABLED=true",
    "RAG_REDIS_URL=rediss://user:password@redis.staging.babyloop.test:6380",
    "RAG_CACHE_BACKEND=redis",
    "RAG_USAGE_LIMITS_BACKEND=redis",
    "RAG_METRICS_BACKEND=redis",
    "GEMINI_API_KEY=gemini-super-secret",
    "EMAIL_DELIVERY_MODE=provider",
    "EMAIL_SEND_ENABLED=true",
    "EMAIL_PROVIDER=resend",
    "EMAIL_FROM=no-reply@babyloop.test",
    "RESEND_API_KEY=resend-super-secret",
    "RESEND_FROM_EMAIL=no-reply@babyloop.test",
    "NOTIFICATION_EMAIL_ENABLED=true",
    "NOTIFICATION_EMAIL_PROVIDER=resend",
    "NOTIFICATION_PUSH_ENABLED=true",
    "PUSH_PROVIDER=expo",
    "EXPO_ACCESS_TOKEN=expo-super-secret",
    `PUSH_TOKEN_ENCRYPTION_KEY=${"p".repeat(48)}`,
    "ASSISTANT_PROVIDER=gemini",
    "OBSERVABILITY_METRICS_ENABLED=true",
    `OBSERVABILITY_METRICS_TOKEN=${"m".repeat(48)}`,
    "HEALTH_REQUIRE_NOTIFICATION_WORKER=true",
    "HEALTH_REQUIRE_CHILD_REMINDER_WORKER=true",
    "HEALTH_FAIL_ON_STALE_NOTIFICATION_CLAIMS=true",
    "NOTIFICATION_PROVIDER_WORKER_ID=staging-notification-worker",
    "CHILD_REMINDER_WORKER_ID=staging-child-reminder-worker",
    "CHILD_REMINDER_PROCESSOR_DRY_RUN=false",
    "BACKUP_ENVIRONMENT=staging",
    "BACKUP_OUTPUT_DIR=/var/lib/babyloop/backups",
    "BACKUP_REPLICA_DIR=/mnt/backup-replica",
    "BACKUP_ENCRYPTION_MODE=age",
    `BACKUP_AGE_RECIPIENT=age1${"q".repeat(58)}`,
    "BACKUP_RETENTION_DAYS=14",
    "BACKUP_RETENTION_COUNT=14",
    "MIGRATION_ENVIRONMENT=staging",
    ""
  ].join("\n");
}

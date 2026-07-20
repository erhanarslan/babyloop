import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRollbackPlan,
  isDigestPinnedImage
} from "../release-ops-lib.mjs";

const digest = `sha256:${"a".repeat(64)}`;

function release(overrides = {}) {
  return {
    schemaVersion: 1,
    createdAt: "2026-07-20T12:00:00.000Z",
    database: {
      forwardCompatibleWithPrevious: true,
      migrationHead: "0043_runtime_readiness_observability"
    },
    environment: "production",
    gitSha: "1".repeat(40),
    releaseId: "production-current",
    services: {
      api: { image: `registry.example/api@${digest}` },
      backoffice: { image: `registry.example/backoffice@${digest}` },
      web: { image: `registry.example/web@${digest}` }
    },
    ...overrides
  };
}

test("accepts immutable digest-pinned images", () => {
  assert.equal(isDigestPinnedImage(`registry.example/api@${digest}`), true);
  assert.equal(isDigestPinnedImage("registry.example/api:latest"), false);
});

test("builds a rollback plan that never down-migrates the database", () => {
  const current = release();
  const target = release({
    createdAt: "2026-07-19T12:00:00.000Z",
    database: {
      forwardCompatibleWithPrevious: true,
      migrationHead: "0042_notification_worker_atomic_claim"
    },
    gitSha: "2".repeat(40),
    releaseId: "production-previous"
  });
  const plan = buildRollbackPlan({ current, target, allowForwardSchema: true });
  assert.equal(plan.database.action, "keep_current_schema");
  assert.equal(plan.toReleaseId, "production-previous");
});

test("refuses rollback across changed schemas without explicit compatibility", () => {
  const current = release({
    database: {
      forwardCompatibleWithPrevious: false,
      migrationHead: "0043_runtime_readiness_observability"
    }
  });
  const target = release({
    createdAt: "2026-07-19T12:00:00.000Z",
    database: {
      forwardCompatibleWithPrevious: true,
      migrationHead: "0042_notification_worker_atomic_claim"
    },
    gitSha: "2".repeat(40),
    releaseId: "production-previous"
  });
  assert.throws(() => buildRollbackPlan({ current, target, allowForwardSchema: true }), /not declared forward-compatible/u);
});

test("refuses mutable rollback image tags", () => {
  const current = release();
  const target = release({
    createdAt: "2026-07-19T12:00:00.000Z",
    gitSha: "2".repeat(40),
    releaseId: "production-previous",
    services: {
      ...release().services,
      api: { image: "registry.example/api:latest" }
    }
  });
  assert.throws(() => buildRollbackPlan({ current, target }), /pinned by sha256 digest/u);
});

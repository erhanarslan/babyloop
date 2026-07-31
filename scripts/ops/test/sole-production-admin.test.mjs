import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { writeJsonReceipt } from "../../deploy/deployment-lib.mjs";
import {
  assertProductionOperationGuard,
  executeSoleProductionAdminOperation,
  safeSoleProductionAdminError,
  SOLE_PRODUCTION_ADMIN_CONFIRMATION,
  SOLE_PRODUCTION_ADMIN_EMAIL
} from "../sole-production-admin-lib.mjs";

const PRODUCTION_DATABASE_URL =
  "postgresql://operator:secret-db-password@db.babyloop.app:5432/babyloop?sslmode=require";
const GIT_SHA = "a".repeat(40);

test("dry-run is the default and never opens a transaction without confirmation", async () => {
  const adapter = createFakeAdapter([targetUser()]);
  const result = await executeOperation({ adapter });

  assert.equal(result.status, "dry_run");
  assert.equal(result.dryRun, true);
  assert.equal(result.targetEmail, SOLE_PRODUCTION_ADMIN_EMAIL);
  assert.equal(adapter.transactionCount, 0);
  assert.equal(adapter.mutationCount, 0);
});

test("missing target user aborts", async () => {
  await assert.rejects(
    executeOperation({ adapter: createFakeAdapter([adminUser("admin@example.com")]) }),
    hasCode("TARGET_NOT_FOUND")
  );
});

test("case-insensitive duplicate target users abort", async () => {
  await assert.rejects(
    executeOperation({
      adapter: createFakeAdapter([
        targetUser(),
        targetUser({ email: "HELP.EARSLAN@GMAIL.COM" })
      ])
    }),
    hasCode("TARGET_NOT_UNIQUE")
  );
});

test("target without a Google auth account aborts", async () => {
  await assert.rejects(
    executeOperation({ adapter: createFakeAdapter([targetUser({ googleAuthAccountCount: 0 })]) }),
    hasCode("GOOGLE_ACCOUNT_INVARIANT")
  );
});

test("unverified target email aborts", async () => {
  await assert.rejects(
    executeOperation({ adapter: createFakeAdapter([targetUser({ emailVerifiedAt: null })]) }),
    hasCode("EMAIL_NOT_VERIFIED")
  );
});

test("login-disabled target aborts", async () => {
  await assert.rejects(
    executeOperation({ adapter: createFakeAdapter([targetUser({ loginDisabled: true })]) }),
    hasCode("LOGIN_DISABLED")
  );
});

test("demo or system target aborts", async () => {
  await assert.rejects(
    executeOperation({ adapter: createFakeAdapter([targetUser({ isDemoSystemAccount: true })]) }),
    hasCode("DEMO_ACCOUNT_REFUSED")
  );
});

test("an already sole target admin is idempotently already_compliant", async () => {
  const receipts = [];
  const adapter = createFakeAdapter([targetUser({ role: "admin" })]);
  const result = await executeOperation({
    adapter,
    apply: true,
    confirmation: SOLE_PRODUCTION_ADMIN_CONFIRMATION,
    writeReceipt: async (receipt) => receipts.push(receipt)
  });

  assert.equal(result.status, "already_compliant");
  assert.equal(adapter.transactionCount, 0);
  assert.equal(adapter.mutationCount, 0);
  assert.deepEqual(receipts, []);
});

test("one existing other admin is demoted and the fixed target is promoted", async () => {
  const adapter = createFakeAdapter([
    targetUser(),
    adminUser("other-admin@example.com")
  ]);
  const result = await executeApply(adapter);

  assert.equal(result.status, "applied");
  assert.deepEqual(adminEmails(adapter.users), [SOLE_PRODUCTION_ADMIN_EMAIL]);
  assert.equal(findUser(adapter.users, "other-admin@example.com").role, "user");
  assert.equal(adapter.lockCount, 1);
});

test("multiple other admins are demoted without deleting or disabling accounts", async () => {
  const adapter = createFakeAdapter([
    targetUser(),
    adminUser("admin-a@example.com"),
    adminUser("admin-b@example.com")
  ]);
  const initialCount = adapter.users.length;
  const result = await executeApply(adapter);

  assert.equal(result.previousAdminCount, 2);
  assert.deepEqual(adminEmails(adapter.users), [SOLE_PRODUCTION_ADMIN_EMAIL]);
  assert.equal(adapter.users.length, initialCount);
  assert.equal(findUser(adapter.users, "admin-a@example.com").loginDisabled, false);
  assert.equal(findUser(adapter.users, "admin-b@example.com").role, "user");
});

test("transaction postcheck failure rolls every role mutation back", async () => {
  const adapter = createFakeAdapter([
    targetUser(),
    adminUser("other-admin@example.com")
  ], { failTransactionPostcheck: true });

  await assert.rejects(executeApply(adapter), hasCode("POSTCHECK_FAILED"));
  assert.deepEqual(adminEmails(adapter.users), ["other-admin@example.com"]);
  assert.equal(findUser(adapter.users, SOLE_PRODUCTION_ADMIN_EMAIL).role, "user");
  assert.equal(adapter.rollbackCount, 1);
});

test("safe output never contains database credentials, ids, hashes, tokens, or sessions", async () => {
  const adapter = createFakeAdapter([targetUser({
    id: "secret-user-id",
    passwordHash: "secret-password-hash",
    providerAccountId: "secret-provider-id",
    token: "secret-token",
    session: "secret-session"
  })]);
  const result = await executeOperation({ adapter });
  const serialized = JSON.stringify(result);

  assert.doesNotMatch(
    serialized,
    /secret-db-password|secret-user-id|secret-password-hash|secret-provider-id|secret-token|secret-session/u
  );
  assert.doesNotMatch(serialized, /DATABASE_URL|postgresql:\/\//u);

  const safeError = safeSoleProductionAdminError(new Error(PRODUCTION_DATABASE_URL));
  assert.doesNotMatch(JSON.stringify(safeError), /secret-db-password|postgresql:\/\//u);
});

test("applied receipt has a checksum and contains only the safe operation evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-sole-admin-"));
  const receiptPath = join(directory, "receipt.json");
  const adapter = createFakeAdapter([targetUser(), adminUser("old-admin@example.com")]);
  const result = await executeApply(adapter, {
    writeReceipt: (receipt) => writeJsonReceipt(receiptPath, receipt)
  });
  const [receiptSource, checksumSource] = await Promise.all([
    readFile(receiptPath, "utf8"),
    readFile(`${receiptPath}.sha256`, "utf8")
  ]);
  const receipt = JSON.parse(receiptSource);

  assert.equal(result.receipt.path, receiptPath);
  assert.equal(receipt.environment, "production");
  assert.equal(receipt.targetEmail, SOLE_PRODUCTION_ADMIN_EMAIL);
  assert.equal(receipt.resultingAdminCount, 1);
  assert.equal(checksumSource.split(/\s+/u)[0], createHash("sha256").update(receiptSource).digest("hex"));
  assert.doesNotMatch(
    receiptSource,
    /secret|password|token|session|databaseUrl|providerAccountId|userId/iu
  );
});

test("apply confirmation must match the exact fixed token", async () => {
  const adapter = createFakeAdapter([targetUser(), adminUser("old-admin@example.com")]);

  await assert.rejects(
    executeOperation({ adapter, apply: true, confirmation: "set_sole_production_admin" }),
    hasCode("CONFIRMATION_MISMATCH")
  );
  assert.equal(adapter.transactionCount, 0);
});

test("production environment and database target checks fail closed", () => {
  assert.doesNotThrow(() => assertProductionOperationGuard({
    databaseUrl: PRODUCTION_DATABASE_URL,
    environment: "production"
  }));
  assert.throws(() => assertProductionOperationGuard({
    databaseUrl: PRODUCTION_DATABASE_URL,
    environment: "staging"
  }), hasCode("ENVIRONMENT_MISMATCH"));
  assert.throws(() => assertProductionOperationGuard({
    databaseUrl: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test?sslmode=require",
    environment: "production"
  }), hasCode("DATABASE_TARGET_REFUSED"));
  assert.throws(() => assertProductionOperationGuard({
    databaseUrl: "postgresql://operator:password@db.staging.babyloop.app:5432/babyloop?sslmode=require",
    environment: "production"
  }), hasCode("DATABASE_TARGET_REFUSED"));
  assert.throws(() => assertProductionOperationGuard({
    databaseUrl: "postgresql://operator:password@db.babyloop.app:5432/babyloop",
    environment: "production"
  }), hasCode("DATABASE_TLS_REQUIRED"));
});

test("a second apply is successful and does not rewrite users or receipts", async () => {
  const receipts = [];
  const adapter = createFakeAdapter([targetUser(), adminUser("old-admin@example.com")]);
  const writeReceipt = async (receipt) => {
    receipts.push(receipt);
    return { checksum: "safe-checksum", path: "/safe/artifact/receipt.json" };
  };

  const first = await executeApply(adapter, { writeReceipt });
  const mutationCountAfterFirstApply = adapter.mutationCount;
  const second = await executeApply(adapter, { writeReceipt });

  assert.equal(first.status, "applied");
  assert.equal(second.status, "already_compliant");
  assert.equal(adapter.mutationCount, mutationCountAfterFirstApply);
  assert.equal(receipts.length, 1);
});

test("unsupported repository role values abort before mutation", async () => {
  const adapter = createFakeAdapter([targetUser({ role: "super_admin" })]);

  await assert.rejects(executeOperation({ adapter }), hasCode("ROLE_INVARIANT"));
  assert.equal(adapter.transactionCount, 0);
});

test("the CLI contract requires an explicit env file and has no target-email flag", async () => {
  const source = await readFile("scripts/ops/set-sole-production-admin.mjs", "utf8");
  const packageSource = await readFile("package.json", "utf8");

  assert.match(source, /--env-file is required and is never inferred/u);
  assert.doesNotMatch(source, /--target-email|--email=/u);
  assert.match(packageSource, /admin:production:sole:plan/u);
  assert.match(packageSource, /admin:production:sole:apply/u);
});

function executeOperation({
  adapter,
  apply = false,
  confirmation,
  writeReceipt = async () => ({ checksum: "safe-checksum", path: "/safe/artifact/receipt.json" })
}) {
  return executeSoleProductionAdminOperation({
    adapter,
    apply,
    confirmation,
    databaseUrl: PRODUCTION_DATABASE_URL,
    environment: "production",
    gitSha: GIT_SHA,
    now: () => new Date("2026-07-31T12:00:00.000Z"),
    writeReceipt
  });
}

function executeApply(adapter, options = {}) {
  return executeOperation({
    adapter,
    apply: true,
    confirmation: SOLE_PRODUCTION_ADMIN_CONFIRMATION,
    ...options
  });
}

function targetUser(overrides = {}) {
  return {
    id: "target-internal-id",
    email: SOLE_PRODUCTION_ADMIN_EMAIL,
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    googleAuthAccountCount: 1,
    isDemoSystemAccount: false,
    loginDisabled: false,
    role: "user",
    ...overrides
  };
}

function adminUser(email) {
  return targetUser({
    id: `internal-${email}`,
    email,
    googleAuthAccountCount: 0,
    role: "admin"
  });
}

function createFakeAdapter(initialUsers, options = {}) {
  let users = structuredClone(initialUsers);
  let transactionCount = 0;
  let mutationCount = 0;
  let lockCount = 0;
  let rollbackCount = 0;

  const adapter = {
    get users() {
      return structuredClone(users);
    },
    get transactionCount() {
      return transactionCount;
    },
    get mutationCount() {
      return mutationCount;
    },
    get lockCount() {
      return lockCount;
    },
    get rollbackCount() {
      return rollbackCount;
    },
    async readSnapshot() {
      return snapshot(users);
    },
    async transaction(work) {
      transactionCount += 1;
      const transactionUsers = structuredClone(users);
      let mutated = false;

      try {
        const result = await work({
          async lockRelevantUsers(email) {
            assert.equal(email, SOLE_PRODUCTION_ADMIN_EMAIL);
            lockCount += 1;
          },
          async readSnapshot() {
            const current = snapshot(transactionUsers);
            return options.failTransactionPostcheck && mutated
              ? { ...current, admins: [] }
              : current;
          },
          async demoteOtherAdmins(targetEmail) {
            for (const user of transactionUsers) {
              if (user.role === "admin" && normalizeEmail(user.email) !== targetEmail) {
                user.role = "user";
                mutationCount += 1;
                mutated = true;
              }
            }
          },
          async promoteTarget(targetEmail, updatedAt) {
            for (const user of transactionUsers) {
              if (normalizeEmail(user.email) === targetEmail) {
                user.role = "admin";
                user.updatedAt = updatedAt.toISOString();
                mutationCount += 1;
                mutated = true;
              }
            }
          }
        });

        users = transactionUsers;
        return result;
      } catch (error) {
        rollbackCount += 1;
        throw error;
      }
    }
  };

  return adapter;
}

function snapshot(users) {
  const projected = users.map((user) => ({
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    googleAuthAccountCount: user.googleAuthAccountCount,
    isDemoSystemAccount: user.isDemoSystemAccount,
    loginDisabled: user.loginDisabled,
    role: user.role
  }));

  return {
    targets: projected.filter((user) => normalizeEmail(user.email) === SOLE_PRODUCTION_ADMIN_EMAIL),
    admins: projected.filter((user) => user.role === "admin")
  };
}

function adminEmails(users) {
  return users
    .filter((user) => user.role === "admin")
    .map((user) => normalizeEmail(user.email))
    .sort();
}

function findUser(users, email) {
  return users.find((user) => normalizeEmail(user.email) === normalizeEmail(email));
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function hasCode(code) {
  return (error) => error?.code === code;
}

export const SOLE_PRODUCTION_ADMIN_EMAIL = "help.earslan@gmail.com";
export const SOLE_PRODUCTION_ADMIN_CONFIRMATION = "SET_SOLE_PRODUCTION_ADMIN";
export const SUPPORTED_USER_ROLES = new Set([
  "admin",
  "backoffice_viewer",
  "moderator",
  "support",
  "user"
]);

const LOCAL_DATABASE_HOSTS = new Set([
  "127.0.0.1",
  "::1",
  "[::1]",
  "localhost"
]);
const NON_PRODUCTION_MARKER = /(?:^|[._-])(dev|development|local|staging|test)(?:[._-]|$)/u;
const PROTECTED_DATABASE_NAMES = new Set(["postgres", "template0", "template1"]);
const PRODUCTION_SSL_MODES = new Set(["require", "verify-ca", "verify-full"]);

export class SoleProductionAdminError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SoleProductionAdminError";
    this.code = code;
  }
}

export function assertProductionOperationGuard({
  apply = false,
  confirmation,
  databaseUrl,
  environment
}) {
  if (environment !== "production") {
    refuse("ENVIRONMENT_MISMATCH", "Environment must be exactly production.");
  }

  const target = parseProductionDatabaseTarget(databaseUrl);

  if (apply && confirmation !== SOLE_PRODUCTION_ADMIN_CONFIRMATION) {
    refuse(
      "CONFIRMATION_MISMATCH",
      `Apply requires ADMIN_BOOTSTRAP_CONFIRM=${SOLE_PRODUCTION_ADMIN_CONFIRMATION}.`
    );
  }

  return target;
}

export function parseProductionDatabaseTarget(databaseUrl) {
  let parsed;

  try {
    parsed = new URL(String(databaseUrl || ""));
  } catch {
    refuse("DATABASE_TARGET_INVALID", "DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
    refuse("DATABASE_TARGET_INVALID", "DATABASE_URL must use the PostgreSQL protocol.");
  }

  const hostname = parsed.hostname.trim().toLowerCase();
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//u, "")).trim();
  const normalizedDatabaseName = databaseName.toLowerCase();
  const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase() ?? "";

  if (!hostname || !databaseName) {
    refuse("DATABASE_TARGET_INVALID", "Production database host and database name are required.");
  }

  if (
    LOCAL_DATABASE_HOSTS.has(hostname)
    || isPrivateIpv4(hostname)
    || hostname.endsWith(".local")
    || NON_PRODUCTION_MARKER.test(hostname)
    || NON_PRODUCTION_MARKER.test(normalizedDatabaseName)
    || PROTECTED_DATABASE_NAMES.has(normalizedDatabaseName)
  ) {
    refuse("DATABASE_TARGET_REFUSED", "Local, staging, test, development, and system databases are refused.");
  }

  if (!PRODUCTION_SSL_MODES.has(sslMode)) {
    refuse(
      "DATABASE_TLS_REQUIRED",
      "Production DATABASE_URL must declare sslmode=require, verify-ca, or verify-full."
    );
  }

  return Object.freeze({
    databaseName,
    hostname,
    sslMode
  });
}

export function buildSoleProductionAdminPlan(snapshot) {
  const targets = snapshot.targets ?? [];
  const admins = snapshot.admins ?? [];

  if (targets.length !== 1) {
    refuse(
      targets.length === 0 ? "TARGET_NOT_FOUND" : "TARGET_NOT_UNIQUE",
      "The fixed production admin email must match exactly one user."
    );
  }

  const target = targets[0];
  assertSupportedRole(target.role);
  for (const admin of admins) {
    assertSupportedRole(admin.role);
  }

  if (Number(target.googleAuthAccountCount) !== 1) {
    refuse("GOOGLE_ACCOUNT_INVARIANT", "The target must have exactly one Google auth account.");
  }
  if (!target.emailVerifiedAt) {
    refuse("EMAIL_NOT_VERIFIED", "The target email must be verified.");
  }
  if (target.loginDisabled !== false) {
    refuse("LOGIN_DISABLED", "The target login must be enabled.");
  }
  if (target.isDemoSystemAccount !== false) {
    refuse("DEMO_ACCOUNT_REFUSED", "Demo or system accounts cannot become the sole production admin.");
  }

  const targetEmail = normalizeEmail(target.email);
  if (targetEmail !== SOLE_PRODUCTION_ADMIN_EMAIL) {
    refuse("TARGET_EMAIL_MISMATCH", "The matched user does not have the fixed target email.");
  }

  const currentAdminEmails = admins
    .map((admin) => normalizeEmail(admin.email))
    .sort((left, right) => left.localeCompare(right));
  const plannedDemotions = currentAdminEmails.filter(
    (email) => email !== SOLE_PRODUCTION_ADMIN_EMAIL
  );

  return {
    targetUserCount: targets.length,
    targetEmail: SOLE_PRODUCTION_ADMIN_EMAIL,
    targetRole: "admin",
    targetEmailVerified: true,
    targetLoginDisabled: false,
    targetDemoSystemAccount: false,
    targetGoogleAuthAccountCount: 1,
    currentAdminCount: admins.length,
    currentAdminEmails,
    plannedDemotions,
    plannedPromotion: target.role === "admin" ? null : SOLE_PRODUCTION_ADMIN_EMAIL,
    invariantStatus: "verified"
  };
}

export function assertSoleProductionAdminPostcheck(snapshot) {
  const plan = buildSoleProductionAdminPlan(snapshot);

  if (
    plan.currentAdminCount !== 1
    || plan.currentAdminEmails[0] !== SOLE_PRODUCTION_ADMIN_EMAIL
    || snapshot.targets[0]?.role !== "admin"
  ) {
    refuse("POSTCHECK_FAILED", "The sole production admin postcheck failed.");
  }

  return plan;
}

export async function executeSoleProductionAdminOperation({
  adapter,
  apply = false,
  confirmation,
  databaseUrl,
  environment,
  gitSha = "",
  now = () => new Date(),
  writeReceipt
}) {
  assertProductionOperationGuard({ apply, confirmation, databaseUrl, environment });
  const initialPlan = buildSoleProductionAdminPlan(await adapter.readSnapshot());

  if (!apply) {
    return {
      ok: true,
      dryRun: true,
      status: "dry_run",
      ...initialPlan
    };
  }

  if (isAlreadyCompliant(initialPlan)) {
    return {
      ok: true,
      dryRun: false,
      status: "already_compliant",
      resultingAdminCount: 1,
      resultingAdminEmail: SOLE_PRODUCTION_ADMIN_EMAIL,
      ...initialPlan
    };
  }

  const changedAt = now();
  const transactionResult = await adapter.transaction(async (transaction) => {
    await transaction.lockRelevantUsers(SOLE_PRODUCTION_ADMIN_EMAIL);
    const lockedPlan = buildSoleProductionAdminPlan(await transaction.readSnapshot());

    if (isAlreadyCompliant(lockedPlan)) {
      return { changed: false, previousAdminCount: lockedPlan.currentAdminCount };
    }

    await transaction.demoteOtherAdmins(SOLE_PRODUCTION_ADMIN_EMAIL, changedAt);
    await transaction.promoteTarget(SOLE_PRODUCTION_ADMIN_EMAIL, changedAt);
    assertSoleProductionAdminPostcheck(await transaction.readSnapshot());

    return { changed: true, previousAdminCount: lockedPlan.currentAdminCount };
  });

  const committedPlan = assertSoleProductionAdminPostcheck(await adapter.readSnapshot());

  if (!transactionResult.changed) {
    return {
      ok: true,
      dryRun: false,
      status: "already_compliant",
      resultingAdminCount: 1,
      resultingAdminEmail: SOLE_PRODUCTION_ADMIN_EMAIL,
      ...committedPlan
    };
  }

  if (!/^[a-f0-9]{40}$/u.test(gitSha)) {
    refuse("GIT_SHA_INVALID", "A full lowercase Git SHA is required for the mutation receipt.");
  }
  if (typeof writeReceipt !== "function") {
    refuse("RECEIPT_WRITER_REQUIRED", "A checksum-protected receipt writer is required for apply.");
  }

  const completedAt = now().toISOString();
  const receipt = await writeReceipt({
    timestamp: completedAt,
    environment: "production",
    operation: "set_sole_production_admin",
    targetEmail: SOLE_PRODUCTION_ADMIN_EMAIL,
    previousAdminCount: transactionResult.previousAdminCount,
    resultingAdminCount: 1,
    resultingAdminEmail: SOLE_PRODUCTION_ADMIN_EMAIL,
    status: "applied",
    gitSha
  });

  return {
    ok: true,
    dryRun: false,
    status: "applied",
    previousAdminCount: transactionResult.previousAdminCount,
    resultingAdminCount: 1,
    resultingAdminEmail: SOLE_PRODUCTION_ADMIN_EMAIL,
    receipt,
    ...committedPlan
  };
}

export function safeSoleProductionAdminError(error) {
  if (error instanceof SoleProductionAdminError) {
    return { code: error.code, message: error.message };
  }

  return {
    code: "OPERATION_FAILED",
    message: "The sole production admin operation failed safely."
  };
}

function assertSupportedRole(role) {
  if (!SUPPORTED_USER_ROLES.has(String(role || "").trim().toLowerCase())) {
    refuse("ROLE_INVARIANT", "A user has a role outside the repository role contract.");
  }
}

function isAlreadyCompliant(plan) {
  return plan.currentAdminCount === 1
    && plan.currentAdminEmails[0] === SOLE_PRODUCTION_ADMIN_EMAIL
    && plan.plannedPromotion === null;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

function refuse(code, message) {
  throw new SoleProductionAdminError(code, message);
}

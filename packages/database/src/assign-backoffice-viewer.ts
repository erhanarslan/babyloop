import { eq } from "drizzle-orm";

import { createDatabaseClient } from "./client.js";
import { users } from "./schema/index.js";
import {
  assertViewerOperatorApplyGuard,
  assertViewerRoleTransition,
  maskOperatorEmail,
} from "./backoffice-viewer-role.js";

const email = process.env.BACKOFFICE_VIEWER_EMAIL?.trim().toLowerCase();
if (!email) throw new Error("BACKOFFICE_VIEWER_EMAIL is required.");

const mode = process.argv.includes("--revoke") ? "revoke" : "assign";
const apply = process.argv.includes("--apply");
const environment = (process.env.DEPLOY_ENVIRONMENT ?? "local").trim().toLowerCase();

assertViewerOperatorApplyGuard({
  apply,
  confirmation: process.env.BACKOFFICE_VIEWER_CONFIRM,
  databaseUrl: process.env.DATABASE_URL,
  environment,
});

const client = createDatabaseClient();

try {
  const matches = await client.db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(2);

  if (matches.length !== 1) throw new Error("Viewer operator requires exactly one matching user.");
  const current = matches[0]!;
  const targetRole = assertViewerRoleTransition(current.role, mode);

  if (apply && current.role !== targetRole) {
    await client.db.update(users).set({ role: targetRole, updatedAt: new Date() }).where(eq(users.id, current.id));
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    dryRun: !apply,
    environment,
    email: maskOperatorEmail(email),
    previousRole: current.role,
    targetRole,
    operation: mode,
    verifiedAt: new Date().toISOString(),
  })}\n`);
} finally {
  await client.close();
}

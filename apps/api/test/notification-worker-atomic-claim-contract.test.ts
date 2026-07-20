import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("notification worker atomic claim contract", () => {
  it("keeps the processing lease fields aligned across schema and migration", () => {
    const schema = source("../../packages/database/src/schema/index.ts");
    const migration = source("../../packages/database/drizzle/0042_notification_worker_atomic_claim.sql");

    for (const token of ["claimToken", "claimedAt", "claimExpiresAt", "workerId"]) {
      expect(schema).toContain(token);
    }

    for (const token of ["claim_token", "claimed_at", "claim_expires_at", "worker_id"]) {
      expect(migration).toContain(token);
    }

    expect(schema).toContain("'processing'");
    expect(migration).toContain("'processing'");
    expect(migration).toContain("notification_delivery_logs_claim_idx");
  });

  it("keeps the migration journaled and the processor command claim-aware", () => {
    const journal = source("../../packages/database/drizzle/meta/_journal.json");
    const worker = source("src/scripts/process-notification-deliveries.ts");

    expect(journal).toContain("0042_notification_worker_atomic_claim");
    expect(worker).toContain("NOTIFICATION_PROVIDER_CLAIM_TTL_MS");
    expect(worker).toContain("workerId");
    expect(worker).toContain("SIGTERM");
  });
});

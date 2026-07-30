import { describe, expect, it } from "vitest";

import { readExpectedMigrationHead } from "../src/services/database-migration-head.service.js";

describe("database migration head", () => {
  it("derives the expected tag and hash from the final journal SQL file", async () => {
    const head = await readExpectedMigrationHead();
    expect(head.tag).toBe("0045_production_demo_marketplace");
    expect(head.hash).toMatch(/^[a-f0-9]{64}$/u);
    expect(head.migrationsFolder).toMatch(/packages\/database\/drizzle$/u);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("dynamic child age contract", () => {
  it("anchors manually entered ages and resolves current age on API reads", () => {
    const schema = source("../../packages/database/src/schema/index.ts");
    const service = source("src/services/child-profiles.service.ts");

    expect(schema).toContain('ageAsOfDate: timestamp("age_as_of_date"');
    expect(service).toContain("buildChildAgeStorageValues");
    expect(service).toContain("resolveChildAgeSnapshot");
    expect(service).toContain("currentChildProfiles.map");
  });

  it("keeps the migration journaled", () => {
    const journal = source("../../packages/database/drizzle/meta/_journal.json");
    expect(journal).toContain("0037_dynamic_child_age");
  });
});

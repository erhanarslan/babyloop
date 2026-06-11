import { describe, expect, it } from "vitest";
import { collectRequestedFieldsForAudit } from "../src/services/admin-sensitive-access-audit.service.js";

describe("admin sensitive access audit service", () => {
  it("collects safe field names from request bodies", () => {
    expect(
      collectRequestedFieldsForAudit({
        fields: ["reporter", "message", "reporter", " conversation "]
      })
    ).toEqual(["reporter", "message", "conversation"]);
  });

  it("omits missing or non-array fields", () => {
    expect(collectRequestedFieldsForAudit({})).toBeUndefined();
    expect(collectRequestedFieldsForAudit({ fields: "reporter" })).toBeUndefined();
    expect(collectRequestedFieldsForAudit(null)).toBeUndefined();
  });

  it("does not keep arbitrary objects or unbounded field strings", () => {
    const longField = "x".repeat(120);

    expect(
      collectRequestedFieldsForAudit({
        fields: ["reporter", { field: "message" }, longField]
      })
    ).toEqual(["reporter", "x".repeat(80)]);
  });
});

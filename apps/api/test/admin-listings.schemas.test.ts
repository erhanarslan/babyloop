import { describe, expect, it } from "vitest";
import {
  adminListingActionBodySchema,
  adminListingParamsSchema,
  adminListingsQuerySchema
} from "../src/schemas/admin-listings.schemas.js";

describe("admin listings schemas", () => {
  it("accepts safe listing list filters", () => {
    const parsed = adminListingsQuerySchema.safeParse({
      status: "archived",
      q: "stroller",
      categoryId: "30000000-0000-4000-8000-000000000001",
      sort: "updated_desc",
      limit: "25"
    });

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.limit).toBe(25);
    }
  });

  it("rejects invalid listing list filters", () => {
    expect(adminListingsQuerySchema.safeParse({ status: "under_review" }).success)
      .toBe(false);
    expect(adminListingsQuerySchema.safeParse({ sort: "seller_email" }).success)
      .toBe(false);
    expect(adminListingsQuerySchema.safeParse({ limit: "500" }).success)
      .toBe(false);
    expect(adminListingsQuerySchema.safeParse({ q: "" }).success).toBe(false);
  });

  it("validates listing params", () => {
    expect(
      adminListingParamsSchema.safeParse({
        listingId: "30000000-0000-4000-8000-000000000001"
      }).success
    ).toBe(true);
    expect(adminListingParamsSchema.safeParse({ listingId: "bad-id" }).success)
      .toBe(false);
  });

  it("requires allowlisted actions and useful reasons", () => {
    expect(
      adminListingActionBodySchema.safeParse({
        action: "archive",
        reason: "Archive listing after marketplace operations review."
      }).success
    ).toBe(true);

    expect(
      adminListingActionBodySchema.safeParse({
        action: "under_review",
        reason: "Move listing under review."
      }).success
    ).toBe(false);

    expect(
      adminListingActionBodySchema.safeParse({
        action: "restore",
        reason: "short"
      }).success
    ).toBe(false);
  });
});

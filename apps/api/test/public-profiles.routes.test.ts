import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCategory, createListing, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

describe("public profile routes", () => {
  let app: TestApp;

  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("returns a safe seller summary without private account fields", async () => {
    const seller = await createUser(app, { email: "public-seller@example.test" });
    const category = await createCategory(app.db, {
      name: "Oyuncak",
      slug: "toys"
    });
    await createListing(app, seller.accessToken, {
      categoryId: category.id,
      title: "Ahşap oyuncak",
      priceAmount: "1000.00"
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/profiles/${seller.profile.id}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.profile).toMatchObject({
      profileId: seller.profile.id,
      displayName: seller.profile.displayName,
      activeListingCount: 1,
      soldListingCount: 0,
      safetyStatus: "active"
    });
    expect(response.body).not.toContain(seller.user.email);
    expect(response.body).not.toContain(seller.user.id);
    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("accessToken");
    expect(response.body).not.toContain("refreshToken");
    expect(response.body).not.toContain("phone");
  });

  it("validates profile ids and returns not found safely", async () => {
    const invalid = await app.inject({
      method: "GET",
      url: "/api/v1/profiles/not-a-uuid"
    });
    const missing = await app.inject({
      method: "GET",
      url: "/api/v1/profiles/99999999-9999-4999-8999-999999999999"
    });

    expect(invalid.statusCode).toBe(400);
    expect(missing.statusCode).toBe(404);
    expect(invalid.body).not.toContain("accessToken");
    expect(missing.body).not.toContain("passwordHash");
  });
});

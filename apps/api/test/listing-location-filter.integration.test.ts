import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUser } from "./helpers/auth.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";
import { createCategory, createListing } from "./helpers/fixtures.js";

describe("public listing location filter", () => {
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

  it("returns only listings whose seller city matches the selected marketplace city", async () => {
    const category = await createCategory(app.db);
    const istanbulSeller = await createUser(app, {
      email: "location-istanbul@example.test",
      locationCity: "İstanbul"
    });
    const ankaraSeller = await createUser(app, {
      email: "location-ankara@example.test",
      locationCity: "Ankara"
    });
    const istanbulListing = await createListing(app, istanbulSeller.accessToken, {
      categoryId: category.id,
      title: "İstanbul bebek arabası"
    });
    const ankaraListing = await createListing(app, ankaraSeller.accessToken, {
      categoryId: category.id,
      title: "Ankara bebek arabası"
    });

    const istanbulResponse = await app.inject({
      method: "GET",
      url: `/api/v1/listings?city=${encodeURIComponent("İstanbul")}&hasImages=true`
    });
    const allTurkeyResponse = await app.inject({
      method: "GET",
      url: "/api/v1/listings?hasImages=true"
    });
    const istanbulIds = istanbulResponse.json().data.listings.map(
      (listing: { id: string }) => listing.id
    );
    const allTurkeyIds = allTurkeyResponse.json().data.listings.map(
      (listing: { id: string }) => listing.id
    );

    expect(istanbulResponse.statusCode).toBe(200);
    expect(istanbulIds).toContain(istanbulListing.id);
    expect(istanbulIds).not.toContain(ankaraListing.id);
    expect(allTurkeyIds).toEqual(expect.arrayContaining([
      istanbulListing.id,
      ankaraListing.id
    ]));
  });
});

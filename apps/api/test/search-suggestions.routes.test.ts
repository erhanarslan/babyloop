import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCategory, createListing, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

describe("search suggestions routes", () => {
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

  it("allows guest access and returns empty suggestions for short queries", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/search-suggestions?q=a"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        suggestions: []
      }
    });
  });

  it("returns public category and listing suggestions with max limit preserved", async () => {
    const seller = await createUser(app, { email: "suggestion-seller@example.test" });
    await createCategory(app.db, {
      name: "Bebek Arabaları",
      slug: "strollers"
    });
    await createListing(app, seller.accessToken, {
      title: "Temiz bebek arabası"
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/search-suggestions?q=bebek&limit=2"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.suggestions.length).toBeLessThanOrEqual(2);
    expect(response.body).toContain("Bebek Arabaları");
    expect(response.body).not.toContain(seller.user.email);
    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("accessToken");
    expect(response.body).not.toContain("refreshToken");
  });

  it("rejects unknown query fields and invalid limits", async () => {
    const unknown = await app.inject({
      method: "GET",
      url: "/api/v1/search-suggestions?q=puset&email=leak@example.test"
    });
    const invalidLimit = await app.inject({
      method: "GET",
      url: "/api/v1/search-suggestions?q=puset&limit=99"
    });

    expect(unknown.statusCode).toBe(400);
    expect(unknown.body).not.toContain("leak@example.test");
    expect(invalidLimit.statusCode).toBe(400);
  });

  it("does not echo script/html search queries into the response", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/search-suggestions?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E"
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("<script>");
    expect(response.body).not.toContain("alert(1)");
  });
});

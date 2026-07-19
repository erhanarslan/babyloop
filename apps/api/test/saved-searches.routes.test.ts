import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authHeader, createCategory, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

describe("saved searches routes", () => {
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

  it("requires auth for listing and creating saved searches", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/api/v1/saved-searches"
    });
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/saved-searches",
      payload: {
        name: "Bebek arabası",
        q: "puset"
      }
    });

    expect(list.statusCode).toBe(401);
    expect(create.statusCode).toBe(401);
  });

  it("creates and lists only current user's saved searches safely", async () => {
    const user = await createUser(app, { email: "saved-owner@example.test" });
    const otherUser = await createUser(app, { email: "saved-other@example.test" });
    const category = await createCategory(app.db, {
      name: "Bebek Arabaları",
      slug: "strollers"
    });

    const created = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/saved-searches",
      payload: {
        name: "Bebek arabası takip",
        q: "puset",
        city: "İstanbul",
        categoryId: category.id,
        condition: "good",
        listingType: "sale",
        priceMin: "1000",
        priceMax: "5000",
        notificationsEnabled: true
      }
    });
    await app.inject({
      headers: authHeader(otherUser.accessToken),
      method: "POST",
      url: "/api/v1/saved-searches",
      payload: {
        name: "Other saved search",
        q: "oyuncak"
      }
    });
    const list = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: "/api/v1/saved-searches"
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      ok: true,
      data: {
        savedSearch: {
          name: "Bebek arabası takip",
          q: "puset",
          city: "İstanbul",
          categoryId: category.id,
          notificationsEnabled: true
        }
      }
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.savedSearches).toHaveLength(1);
    expect(list.body).toContain("Bebek arabası takip");
    expect(list.body).not.toContain("Other saved search");
    expect(list.body).not.toContain(user.user.email);
    expect(list.body).not.toContain("passwordHash");
    expect(list.body).not.toContain("accessToken");
    expect(list.body).not.toContain("refreshToken");
  });

  it("rejects unknown fields and invalid notification toggle bodies", async () => {
    const user = await createUser(app);

    const unknownField = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/saved-searches",
      payload: {
        name: "Private field attempt",
        q: "puset",
        email: "leak@example.test"
      }
    });

    expect(unknownField.statusCode).toBe(400);
    expect(unknownField.body).not.toContain("leak@example.test");
  });

  it("updates notifications and prevents cross-user update/delete", async () => {
    const user = await createUser(app);
    const otherUser = await createUser(app);
    const created = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/saved-searches",
      payload: {
        name: "Puset alarmı",
        q: "puset"
      }
    });
    const savedSearchId = created.json().data.savedSearch.id as string;

    const updated = await app.inject({
      headers: authHeader(user.accessToken),
      method: "PATCH",
      url: `/api/v1/saved-searches/${savedSearchId}/notifications`,
      payload: {
        notificationsEnabled: true
      }
    });
    const invalid = await app.inject({
      headers: authHeader(user.accessToken),
      method: "PATCH",
      url: `/api/v1/saved-searches/${savedSearchId}/notifications`,
      payload: {
        notificationsEnabled: "yes"
      }
    });
    const crossUpdate = await app.inject({
      headers: authHeader(otherUser.accessToken),
      method: "PATCH",
      url: `/api/v1/saved-searches/${savedSearchId}/notifications`,
      payload: {
        notificationsEnabled: false
      }
    });
    const crossDelete = await app.inject({
      headers: authHeader(otherUser.accessToken),
      method: "DELETE",
      url: `/api/v1/saved-searches/${savedSearchId}`
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.savedSearch.notificationsEnabled).toBe(true);
    expect(invalid.statusCode).toBe(400);
    expect(crossUpdate.statusCode).toBe(404);
    expect(crossDelete.statusCode).toBe(404);
  });
});

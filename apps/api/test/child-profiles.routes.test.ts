import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authHeader, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

describe("child profiles routes", () => {
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

  it("requires auth for listing and creating child profiles", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/api/v1/child-profiles"
    });
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/child-profiles",
      payload: {
        ageBand: "infant_6_12"
      }
    });

    expect(list.statusCode).toBe(401);
    expect(create.statusCode).toBe(401);
  });

  it("rejects invalid child profile bodies", async () => {
    const user = await createUser(app);

    const response = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/child-profiles",
      payload: {
        ageBand: "medical_diagnosis"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_CHILD_PROFILE_REQUEST"
      }
    });
  });

  it("rejects invalid child profile params and update bodies before service access", async () => {
    const user = await createUser(app);

    const invalidParam = await app.inject({
      headers: authHeader(user.accessToken),
      method: "PATCH",
      url: "/api/v1/child-profiles/not-a-uuid",
      payload: {
        label: "Ada"
      }
    });
    const emptyBody = await app.inject({
      headers: authHeader(user.accessToken),
      method: "PATCH",
      url: "/api/v1/child-profiles/11111111-1111-4111-8111-111111111111",
      payload: {}
    });

    expect(invalidParam.statusCode).toBe(400);
    expect(emptyBody.statusCode).toBe(400);
    expect(invalidParam.body).not.toContain(user.user.email);
    expect(emptyBody.body).not.toContain("accessToken");
  });

  it("creates and updates weekly child profile notification cadence", async () => {
    const user = await createUser(app, { email: "weekly-child-profile@example.test" });

    const create = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/child-profiles",
      payload: {
        ageBand: "toddler_12_24",
        label: "Haftalık Öneriler",
        notificationCadence: "weekly"
      }
    });

    expect(create.statusCode).toBe(201);
    expect(create.json().data.childProfile).toMatchObject({
      ageBand: "toddler_12_24",
      label: "Haftalık Öneriler",
      notificationCadence: "weekly"
    });

    const childProfileId = create.json().data.childProfile.id;

    const update = await app.inject({
      headers: authHeader(user.accessToken),
      method: "PATCH",
      url: `/api/v1/child-profiles/${childProfileId}`,
      payload: {
        notificationCadence: "monthly"
      }
    });

    expect(update.statusCode).toBe(200);
    expect(update.json().data.childProfile.notificationCadence).toBe("monthly");
    expect(`${create.body} ${update.body}`).not.toMatch(/weekly-child-profile@example|accessToken|refreshToken|passwordHash/iu);
  });


});

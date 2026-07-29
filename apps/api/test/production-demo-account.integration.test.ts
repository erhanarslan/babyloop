import { notifications, users } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createNotification } from "../src/services/notifications.service.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { createUser } from "./helpers/auth.js";
import { resetTestDatabase } from "./helpers/db.js";

let app!: TestApp;

beforeEach(async () => {
  await resetTestDatabase();
  app = await createTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("production demo accounts", () => {
  it("cannot log in even with the pre-disable password", async () => {
    const account = await createUser(app, { email: "demo-seller-01@demo.babyloop.invalid" });
    await app.db.update(users).set({
      isDemoSystemAccount: true,
      loginDisabled: true,
      providerDeliveryDisabled: true
    }).where(eq(users.id, account.user.id));

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: account.user.email, password: "Password123!" }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("INVALID_CREDENTIALS");
  });

  it("is never selected as an email/push/provider notification target", async () => {
    const account = await createUser(app, { email: "demo-seller-02@demo.babyloop.invalid" });
    await app.db.update(users).set({
      isDemoSystemAccount: true,
      loginDisabled: true,
      providerDeliveryDisabled: true
    }).where(eq(users.id, account.user.id));

    const created = await createNotification(app, {
      recipientProfileId: account.profile.id,
      type: "system",
      title: "Demo delivery",
      body: "Bu bildirim provider kuyruğuna girmemelidir."
    });
    const rows = await app.db.select({ id: notifications.id }).from(notifications);

    expect(created).toBeNull();
    expect(rows).toHaveLength(0);
  });
});

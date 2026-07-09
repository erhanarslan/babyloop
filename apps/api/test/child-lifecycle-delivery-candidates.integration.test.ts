import { notificationDeliveryLogs, productCategories } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authHeader, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

describe("child lifecycle delivery candidates", () => {
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

  it("creates weekly age-based marketplace recommendation candidates for email, push, and n8n without duplicates", async () => {
    const user = await createUser(app, { email: "child-lifecycle-weekly@example.test" });

    await seedLifecycleCategories(app);

    for (const channel of ["in_app", "email", "push", "n8n"] as const) {
      const preference = await app.inject({
        headers: authHeader(user.accessToken),
        method: "PATCH",
        url: "/api/v1/notification-preferences",
        payload: {
          source: "child_lifecycle",
          channel,
          enabled: true,
          reason: "weekly lifecycle candidate test"
        }
      });

      expect(preference.statusCode).toBe(200);
    }

    const childProfile = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/child-profiles",
      payload: {
        ageBand: "toddler_12_24",
        label: "Haftalık Çocuk",
        notificationCadence: "weekly"
      }
    });

    expect(childProfile.statusCode).toBe(201);

    const generate = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/notifications/child-lifecycle/generate"
    });

    expect(generate.statusCode).toBe(200);
    expect(generate.json().data).toMatchObject({
      createdCount: 2,
      skippedCount: 0,
      deliveryCandidateSummary: {
        created: 6,
        duplicate: 0,
        skipped: 0
      }
    });

    const logs = await app.db
      .select({
        kind: notificationDeliveryLogs.kind,
        sourceId: notificationDeliveryLogs.sourceId,
        channel: notificationDeliveryLogs.channel,
        status: notificationDeliveryLogs.status,
        provider: notificationDeliveryLogs.provider,
        providerStatus: notificationDeliveryLogs.providerStatus,
        frequencyWindowHours: notificationDeliveryLogs.frequencyWindowHours,
        metadata: notificationDeliveryLogs.metadata
      })
      .from(notificationDeliveryLogs)
      .where(eq(notificationDeliveryLogs.profileId, user.profile.id));

    expect(logs).toHaveLength(6);
    expect(logs.map((log) => log.channel).sort()).toEqual([
      "email",
      "email",
      "n8n",
      "n8n",
      "push",
      "push"
    ]);
    expect(logs.every((log) => log.kind === "child_lifecycle")).toBe(true);
    expect(logs.every((log) => log.status === "candidate")).toBe(true);
    expect(logs.every((log) => log.provider === null)).toBe(true);
    expect(logs.every((log) => log.providerStatus === null)).toBe(true);
    expect(logs.every((log) => log.frequencyWindowHours === 24 * 7)).toBe(true);
    expect(logs.every((log) => log.sourceId.includes(":"))).toBe(true);
    expect(logs.every((log) => Boolean((log.metadata as Record<string, unknown>).categoryId))).toBe(true);
    expect(JSON.stringify({ body: generate.json().data, logs })).not.toMatch(
      /child-lifecycle-weekly@example|accessToken|refreshToken|passwordHash|authorization|cookie|api[_-]?key|secret|ExponentPushToken/iu
    );
  });
});

async function seedLifecycleCategories(app: TestApp): Promise<void> {
  const values = [
    { name: "Bebek arabaları", slug: "strollers" },
    { name: "Oto koltukları", slug: "car-seats" },
    { name: "Oyuncaklar", slug: "toys" },
    { name: "Montessori oyuncakları", slug: "montessori-toys" }
  ];

  for (const value of values) {
    await app.db
      .insert(productCategories)
      .values(value)
      .onConflictDoNothing({
        target: productCategories.slug
      });
  }
}

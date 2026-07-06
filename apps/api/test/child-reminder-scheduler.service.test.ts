import { notificationDeliveryLogs } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { processDueChildReminderNotifications } from "../src/services/child-reminder-scheduler.service.js";
import { authHeader, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

describe("child reminder scheduler service", () => {
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

  it("creates draft-only delivery logs for due reminders and advances one-time reminders", async () => {
    const user = await createUser(app, { email: "child-reminder-scheduler@example.test" });
    const childProfileId = await createChildProfile(user.accessToken);
    const reminderId = await createReminder(user.accessToken, childProfileId, {
      title: "Bez al",
      scheduleKind: "one_time",
      dueAt: "2030-01-01T09:00:00.000Z"
    });

    const summary = await processDueChildReminderNotifications(app, {
      now: new Date("2030-01-01T10:00:00.000Z")
    });
    const logs = await app.db
      .select()
      .from(notificationDeliveryLogs)
      .where(eq(notificationDeliveryLogs.profileId, user.profile.id));

    expect(summary).toMatchObject({
      processed: 1,
      created: 1,
      skipped: 0,
      blocked: 0,
      providerCallsAllowed: false,
      deliveryAllowed: false
    });
    expect(summary.note).toContain("without real email, push, SMS, n8n, queue, or provider sending");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      kind: "child_reminder",
      channel: "in_app",
      deliveryAllowed: false,
      draftOnly: true
    });

    const listResponse = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: `/api/v1/child-profiles/${childProfileId}/reminders`
    });
    const reminder = listResponse.json().data.reminders.find((item: { id: string }) => item.id === reminderId);

    expect(reminder.status).toBe("completed");
    expect(JSON.stringify({ summary, logs, reminder })).not.toMatch(/child-reminder-scheduler@example|accessToken|refreshToken|passwordHash|sendEmail|sendPush|n8n webhook/iu);
  });

  it("respects disabled child reminder preferences and dry-run mode", async () => {
    const user = await createUser(app, { email: "child-reminder-scheduler-disabled@example.test" });
    const childProfileId = await createChildProfile(user.accessToken);
    await createReminder(user.accessToken, childProfileId, {
      title: "Etkinlik çantası",
      scheduleKind: "interval",
      intervalMinutes: 120
    });
    await app.inject({
      headers: authHeader(user.accessToken),
      method: "PATCH",
      url: "/api/v1/notification-preferences",
      payload: {
        source: "child_reminder",
        channel: "in_app",
        enabled: false
      }
    });

    const skipped = await processDueChildReminderNotifications(app, {
      now: new Date("2030-01-01T10:00:00.000Z")
    });
    const dryRun = await processDueChildReminderNotifications(app, {
      now: new Date("2030-01-01T10:00:00.000Z"),
      dryRun: true
    });
    const logs = await app.db
      .select()
      .from(notificationDeliveryLogs)
      .where(eq(notificationDeliveryLogs.profileId, user.profile.id));

    expect(skipped.results[0]).toMatchObject({
      status: "skipped",
      reason: "preference_disabled"
    });
    expect(dryRun.dryRun).toBe(true);
    expect(logs).toHaveLength(0);
  });

  async function createChildProfile(accessToken: string): Promise<string> {
    const response = await app.inject({
      headers: authHeader(accessToken),
      method: "POST",
      url: "/api/v1/child-profiles",
      payload: {
        ageBand: "toddler_12_24",
        label: "Ada"
      }
    });

    expect(response.statusCode).toBe(201);

    return response.json().data.childProfile.id;
  }

  async function createReminder(
    accessToken: string,
    childProfileId: string,
    payload: Record<string, unknown>
  ): Promise<string> {
    const response = await app.inject({
      headers: authHeader(accessToken),
      method: "POST",
      url: `/api/v1/child-profiles/${childProfileId}/reminders`,
      payload
    });

    expect(response.statusCode).toBe(201);

    return response.json().data.reminder.id;
  }
});

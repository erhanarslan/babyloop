import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authHeader, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

describe("child profile notes and reminders routes", () => {
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

  it("requires auth for child notes and reminder endpoints", async () => {
    const childProfileId = "11111111-1111-4111-8111-111111111111";

    const notes = await app.inject({
      method: "GET",
      url: `/api/v1/child-profiles/${childProfileId}/notes`
    });
    const reminders = await app.inject({
      method: "POST",
      url: `/api/v1/child-profiles/${childProfileId}/reminders`,
      payload: {
        title: "Bez al",
        remindAt: "2030-01-01T10:00:00.000Z"
      }
    });

    expect(notes.statusCode).toBe(401);
    expect(reminders.statusCode).toBe(401);
  });

  it("creates, updates, lists, and archives child profile notes for the owner", async () => {
    const user = await createUser(app, { email: "child-note-owner@example.test" });
    const childProfileId = await createChildProfile(user.accessToken);

    const createResponse = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: `/api/v1/child-profiles/${childProfileId}/notes`,
      payload: {
        noteType: "feeding",
        title: "  Beslenme notu  ",
        body: "  Kahvaltıda muz seviyor.  "
      }
    });
    const note = createResponse.json().data.note;

    expect(createResponse.statusCode).toBe(201);
    expect(note).toMatchObject({
      childProfileId,
      noteType: "feeding",
      title: "Beslenme notu",
      body: "Kahvaltıda muz seviyor.",
      isArchived: false
    });
    expect(createResponse.body).not.toContain(user.user.email);

    const updateResponse = await app.inject({
      headers: authHeader(user.accessToken),
      method: "PATCH",
      url: `/api/v1/child-profiles/${childProfileId}/notes/${note.id}`,
      payload: {
        noteType: "sleep",
        title: "Uyku notu",
        body: "Öğlen uykusu 13:00 civarı."
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().data.note).toMatchObject({
      noteType: "sleep",
      title: "Uyku notu",
      body: "Öğlen uykusu 13:00 civarı."
    });

    const listResponse = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: `/api/v1/child-profiles/${childProfileId}/notes`
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().data.notes).toHaveLength(1);

    const archiveResponse = await app.inject({
      headers: authHeader(user.accessToken),
      method: "DELETE",
      url: `/api/v1/child-profiles/${childProfileId}/notes/${note.id}`
    });
    const afterArchiveList = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: `/api/v1/child-profiles/${childProfileId}/notes`
    });

    expect(archiveResponse.statusCode).toBe(200);
    expect(archiveResponse.json().data.archived).toBe(true);
    expect(afterArchiveList.json().data.notes).toHaveLength(0);
  });

  it("creates, completes, and cancels child profile reminders for the owner", async () => {
    const user = await createUser(app, { email: "child-reminder-owner@example.test" });
    const childProfileId = await createChildProfile(user.accessToken);

    const createResponse = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: `/api/v1/child-profiles/${childProfileId}/reminders`,
      payload: {
        title: "Bez al",
        description: "Hafta sonu alışveriş listesine ekle.",
        remindAt: "2030-01-01T10:00:00.000Z",
        channel: "in_app"
      }
    });
    const reminder = createResponse.json().data.reminder;

    expect(createResponse.statusCode).toBe(201);
    expect(reminder).toMatchObject({
      childProfileId,
      title: "Bez al",
      description: "Hafta sonu alışveriş listesine ekle.",
      channel: "in_app",
      status: "scheduled"
    });

    const completeResponse = await app.inject({
      headers: authHeader(user.accessToken),
      method: "PATCH",
      url: `/api/v1/child-profiles/${childProfileId}/reminders/${reminder.id}`,
      payload: {
        status: "completed"
      }
    });

    expect(completeResponse.statusCode).toBe(200);
    expect(completeResponse.json().data.reminder).toMatchObject({
      status: "completed",
      cancelledAt: null
    });
    expect(completeResponse.json().data.reminder.completedAt).toEqual(expect.any(String));

    const secondCreate = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: `/api/v1/child-profiles/${childProfileId}/reminders`,
      payload: {
        title: "Etkinlik çantası",
        remindAt: "2030-01-02T10:00:00.000Z"
      }
    });
    const secondReminder = secondCreate.json().data.reminder;

    const cancelResponse = await app.inject({
      headers: authHeader(user.accessToken),
      method: "DELETE",
      url: `/api/v1/child-profiles/${childProfileId}/reminders/${secondReminder.id}`
    });
    const listResponse = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: `/api/v1/child-profiles/${childProfileId}/reminders`
    });

    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.json().data.cancelled).toBe(true);
    expect(listResponse.json().data.reminders.map((item: { id: string }) => item.id)).not.toContain(
      secondReminder.id
    );
  });

  it("rejects unsafe child note/reminder text and invalid params", async () => {
    const user = await createUser(app);
    const childProfileId = await createChildProfile(user.accessToken);

    const unsafeNote = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: `/api/v1/child-profiles/${childProfileId}/notes`,
      payload: {
        title: "<script>alert(1)</script>",
        body: "safe"
      }
    });
    const invalidReminder = await app.inject({
      headers: authHeader(user.accessToken),
      method: "PATCH",
      url: `/api/v1/child-profiles/${childProfileId}/reminders/not-a-uuid`,
      payload: {
        status: "completed"
      }
    });

    expect(unsafeNote.statusCode).toBe(400);
    expect(invalidReminder.statusCode).toBe(400);
    expect(unsafeNote.body).not.toContain("<script");
    expect(invalidReminder.body).not.toContain(user.user.email);
  });

  it("does not allow cross-user access to another profile child notes or reminders", async () => {
    const owner = await createUser(app, { email: "child-owner@example.test" });
    const other = await createUser(app, { email: "child-other@example.test" });
    const childProfileId = await createChildProfile(owner.accessToken);

    const noteResponse = await app.inject({
      headers: authHeader(owner.accessToken),
      method: "POST",
      url: `/api/v1/child-profiles/${childProfileId}/notes`,
      payload: {
        title: "Private child note",
        body: "No leak."
      }
    });
    const noteId = noteResponse.json().data.note.id;

    const otherList = await app.inject({
      headers: authHeader(other.accessToken),
      method: "GET",
      url: `/api/v1/child-profiles/${childProfileId}/notes`
    });
    const otherPatch = await app.inject({
      headers: authHeader(other.accessToken),
      method: "PATCH",
      url: `/api/v1/child-profiles/${childProfileId}/notes/${noteId}`,
      payload: {
        title: "Stolen"
      }
    });

    expect(otherList.statusCode).toBe(404);
    expect(otherPatch.statusCode).toBe(404);
    expect(otherList.body).not.toContain(owner.user.email);
    expect(otherPatch.body).not.toContain(owner.user.email);
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
});

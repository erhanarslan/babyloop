import { describe, expect, it } from "vitest";
import {
  createChildProfileNoteBodySchema,
  createChildProfileReminderBodySchema,
  updateChildProfileNoteBodySchema,
  updateChildProfileReminderBodySchema
} from "../src/schemas/child-profile-notes-reminders.schemas.js";

describe("child profile notes and reminders schemas", () => {
  it("normalizes safe child note plaintext and rejects unknown fields", () => {
    const parsed = createChildProfileNoteBodySchema.parse({
      noteType: "preference",
      title: "  Park çantası  ",
      body: "  Yedek kıyafet ve suluk hazır.  "
    });

    expect(parsed).toEqual({
      noteType: "preference",
      title: "Park çantası",
      body: "Yedek kıyafet ve suluk hazır."
    });
    expect(
      createChildProfileNoteBodySchema.safeParse({
        title: "Park çantası",
        body: "Hazır.",
        accessToken: "must-not-be-accepted"
      }).success
    ).toBe(false);
  });

  it("rejects HTML/script/control character abuse in child notes", () => {
    const scriptTitle = createChildProfileNoteBodySchema.safeParse({
      title: "<script>alert(1)</script>",
      body: "safe"
    });
    const controlCharacterBody = createChildProfileNoteBodySchema.safeParse({
      title: "Uyku notu",
      body: "Gece\u0000uyandı"
    });

    expect(scriptTitle.success).toBe(false);
    expect(controlCharacterBody.success).toBe(false);
  });

  it("requires update payloads to include at least one note or reminder field", () => {
    expect(updateChildProfileNoteBodySchema.safeParse({}).success).toBe(false);
    expect(updateChildProfileReminderBodySchema.safeParse({}).success).toBe(false);
  });

  it("accepts reminder draft channels without enabling real delivery channels", () => {
    const parsed = createChildProfileReminderBodySchema.parse({
      title: "  Bez stok kontrolü  ",
      description: "Hafta sonu alışverişinden önce kontrol et.",
      remindAt: "2030-01-01T10:00:00.000Z",
      channel: "email_draft"
    });

    expect(parsed).toMatchObject({
      title: "Bez stok kontrolü",
      description: "Hafta sonu alışverişinden önce kontrol et.",
      channel: "email_draft"
    });
    expect(parsed.remindAt).toBeInstanceOf(Date);
    expect(
      createChildProfileReminderBodySchema.safeParse({
        title: "Bez stok kontrolü",
        remindAt: "2030-01-01T10:00:00.000Z",
        channel: "push"
      }).success
    ).toBe(false);
  });

  it("rejects unsafe reminder text and sensitive-looking extra fields", () => {
    expect(
      createChildProfileReminderBodySchema.safeParse({
        title: "Hatırlatma",
        description: "parent@example.test <img src=x onerror=alert(1)>",
        remindAt: "2030-01-01T10:00:00.000Z"
      }).success
    ).toBe(false);
    expect(
      updateChildProfileReminderBodySchema.safeParse({
        title: "Güncelle",
        passwordHash: "must-not-be-accepted"
      }).success
    ).toBe(false);
  });
});

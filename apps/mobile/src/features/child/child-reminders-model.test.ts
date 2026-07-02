import {
  getMobileChildNoteItems,
  getMobileChildReminderItems,
  getMobileChildReminderSettings
} from "./child-reminders-model";

describe("mobile child reminders model", () => {
  it("exposes release-critical child note cards", () => {
    expect(getMobileChildNoteItems()).toEqual([
      { title: "Beslenme", value: "2 saatte bir" },
      { title: "Bez", value: "Günlük takip" },
      { title: "Etkinlik", value: "Randevu ve oyun" },
      { title: "Alışveriş", value: "Bez, mama, ihtiyaç" }
    ]);
  });

  it("keeps reminder examples practical and non-medical", () => {
    const reminders = getMobileChildReminderItems();

    expect(reminders).toHaveLength(3);
    expect(reminders.join(" ")).not.toMatch(/ilaç|tedavi|tanı|terapi|diyet/i);
  });

  it("exposes notification settings without claiming real push delivery", () => {
    const settings = getMobileChildReminderSettings();

    expect(settings).toEqual([
      { title: "Beslenme", value: "2 saatte bir" },
      { title: "Bez takibi", value: "Günlük" },
      { title: "Etkinlik", value: "1 hafta ve 1 gün önce" },
      { title: "Alışveriş", value: "Seçilen gün sabah 10:00" }
    ]);

    expect(settings.map((item) => item.value).join(" ")).not.toMatch(/push|delivery|servis/i);
  });
});

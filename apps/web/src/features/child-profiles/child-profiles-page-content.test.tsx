import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/features/child-profiles/child-profiles-page-content.tsx"), "utf8");

describe("ChildProfilesPageContent", () => {
  it("does not render fake notebook preview records as production data", () => {
    expect(source).not.toContain("buildNotebookPreviewItems");
    expect(source).not.toContain("2 saatte bir");
    expect(source).toContain("Henüz not veya hatırlatıcı yok.");
  });

  it("uses real schedule fields for child reminder creation", () => {
    expect(source).toContain("buildWebChildReminderCreatePayloadFromState");
    expect(source).toContain("relative_before_event");
    expect(source).toContain("interval");
    expect(source).toContain("type=\"date\"");
    expect(source).toContain("type=\"time\"");
  });
});

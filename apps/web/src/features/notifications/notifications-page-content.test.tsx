import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/features/notifications/notifications-page-content.tsx"),
  "utf8"
);

describe("NotificationsPageContent", () => {
  it("shows recent notifications in controlled batches of five", () => {
    expect(source).toContain("const NOTIFICATION_PAGE_SIZE = 5");
    expect(source).toContain("visibleNotificationCount");
    expect(source).toContain("Daha fazlasını göster");
    expect(source).toContain("Math.min(currentCount + NOTIFICATION_PAGE_SIZE, notifications.length)");
  });
});

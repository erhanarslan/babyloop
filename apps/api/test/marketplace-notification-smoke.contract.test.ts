import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("marketplace notification smoke contract", () => {
  const script = readFileSync(
    join(process.cwd(), "src/scripts/smoke-marketplace-email-notifications.ts"),
    "utf8"
  );

  it("requires explicit send confirmation and an owned recipient", () => {
    expect(script).toContain("NOTIFICATION_MARKETPLACE_SMOKE_CONFIRM_SEND");
    expect(script).toContain("NOTIFICATION_SMOKE_RECIPIENT_EMAIL");
    expect(script).toContain("existing BabyLoop account");
    expect(script).toContain("email must be verified");
  });

  it("executes only its two delivery log ids instead of draining the global queue", () => {
    expect(script).toContain("executeNotificationProviderDelivery");
    expect(script).toContain("message_received");
    expect(script).toContain("listing_favorited");
    expect(script).not.toContain("processPendingNotificationProviderDeliveries");
  });

  it("redacts recipient and secret material from smoke output", () => {
    expect(script).toContain("assertRedactedOutput");
    expect(script).toContain("redactEmail");
    expect(script).toMatch(/accessToken\|refreshToken\|passwordHash/iu);
  });
});

import type { MobileAuthSession } from "../auth/auth-api";
import {
  buildMobileSessionCards,
  formatMobileSessionDate
} from "./mobile-session-model";

const sessions: MobileAuthSession[] = [
  {
    id: "session-mobile",
    current: false,
    deviceLabel: "Android cihaz",
    userAgent: "BabyLoopMobile Android accessToken=secret-token",
    ipAddress: null,
    createdAt: "2030-01-01T10:00:00.000Z",
    updatedAt: "2030-01-01T10:10:00.000Z",
    expiresAt: "2030-02-01T10:00:00.000Z"
  },
  {
    id: "session-current",
    current: true,
    deviceLabel: "Mac tarayıcı",
    userAgent: "Mozilla/5.0 Macintosh",
    ipAddress: "127.0.0.1",
    createdAt: "2030-01-02T10:00:00.000Z",
    updatedAt: "2030-01-02T10:10:00.000Z",
    expiresAt: "2030-02-02T10:00:00.000Z"
  }
];

describe("mobile session model", () => {
  it("prioritizes the current session and exposes compact revoke actions", () => {
    const cards = buildMobileSessionCards(sessions, "session-current");

    expect(cards[0]).toMatchObject({
      id: "session-current",
      isCurrent: true,
      actionLabel: ""
    });
    expect(cards[1]).toMatchObject({
      id: "session-mobile",
      isCurrent: false,
      actionLabel: "Kapat"
    });
  });

  it("keeps active device display free of IP, expiry, and token-like values", () => {
    const cards = buildMobileSessionCards(sessions, "session-current");

    expect(JSON.stringify(cards)).not.toMatch(/127\.0\.0\.1|Bitiş|expiresAt|secret-token|refreshToken|passwordHash/iu);
    expect(cards[0]?.meta).toContain("Son etkinlik:");
  });

  it("formats invalid dates defensively", () => {
    expect(formatMobileSessionDate("not-a-date")).toBe("Bilinmiyor");
  });
});

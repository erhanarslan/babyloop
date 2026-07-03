import {
  buildMobileSessionCards,
  formatMobileSessionDate,
  getMobileSessionSummary
} from "./mobile-session-model";
import type { MobileAuthSession } from "../auth/auth-api";

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
  it("prioritizes the current session and hides token-like values", () => {
    const cards = buildMobileSessionCards(sessions, "session-current");

    expect(cards[0]).toMatchObject({
      id: "session-current",
      isCurrent: true,
      actionLabel: "Bu oturumu kapat"
    });
    expect(cards[1]).toMatchObject({
      id: "session-mobile",
      isCurrent: false,
      actionLabel: "Oturumu kapat"
    });
    expect(JSON.stringify(cards)).not.toMatch(/secret-token|refreshToken|passwordHash/iu);
  });

  it("builds a compact summary for the security screen", () => {
    expect(getMobileSessionSummary(sessions, "session-current")).toEqual({
      activeCountLabel: "2 aktif oturum",
      currentDeviceLabel: "Bu cihaz eşleşti"
    });
    expect(getMobileSessionSummary(sessions, null).currentDeviceLabel).toBe("Bu cihaz eşleşmedi");
  });

  it("formats invalid dates defensively", () => {
    expect(formatMobileSessionDate("not-a-date")).toBe("Bilinmiyor");
  });
});

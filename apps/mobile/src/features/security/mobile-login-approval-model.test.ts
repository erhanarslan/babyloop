import {
  buildMobileLoginApprovalCards,
  getMobileLoginApprovalSummary
} from "./mobile-login-approval-model";
import type { MobileLoginApprovalChallenge } from "../auth/auth-api";

const approvals: MobileLoginApprovalChallenge[] = [
  {
    id: "approval-1",
    status: "pending",
    deviceLabel: "Mac tarayıcı",
    requestUserAgent: "Mozilla BabyLoopWeb",
    requestIpAddress: "10.0.0.10",
    createdAt: "2026-07-04T01:00:00.000Z",
    expiresAt: "2026-07-04T01:10:00.000Z",
    resolvedAt: null
  },
  {
    id: "approval-2",
    status: "approved",
    deviceLabel: "Android cihaz",
    requestUserAgent: null,
    requestIpAddress: null,
    createdAt: "2026-07-04T01:00:00.000Z",
    expiresAt: "2026-07-04T01:10:00.000Z",
    resolvedAt: "2026-07-04T01:05:00.000Z"
  },
  {
    id: "approval-denied",
    status: "denied",
    deviceLabel: "Şüpheli tarayıcı",
    requestUserAgent: "Unknown Browser",
    requestIpAddress: "10.0.0.11",
    createdAt: "2026-07-04T01:00:00.000Z",
    expiresAt: "2026-07-04T01:10:00.000Z",
    resolvedAt: "2026-07-04T01:06:00.000Z"
  },
  {
    id: "approval-expired",
    status: "expired",
    deviceLabel: "Eski istek",
    requestUserAgent: null,
    requestIpAddress: null,
    createdAt: "2026-07-04T00:00:00.000Z",
    expiresAt: "2026-07-04T00:10:00.000Z",
    resolvedAt: null
  }
];

describe("mobile login approval model", () => {
  it("builds cards only for pending approval requests without exposing secrets", () => {
    const cards = buildMobileLoginApprovalCards(approvals);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      id: "approval-1",
      title: "Mac tarayıcı",
      subtitle: "IP: 10.0.0.10 · Mozilla BabyLoopWeb",
      approveLabel: "Onayla",
      denyLabel: "Reddet"
    });
    expect(JSON.stringify(cards)).not.toMatch(/approvalToken|approvalTokenHash|refreshToken|passwordHash/iu);
  });

  it("keeps denied and expired approval requests out of actionable cards", () => {
    const cards = buildMobileLoginApprovalCards(approvals);

    expect(cards).toHaveLength(1);
    expect(cards.map((card) => card.id)).toEqual(["approval-1"]);
    expect(JSON.stringify(cards)).not.toMatch(/approval-denied|approval-expired|approvalToken|approvalTokenHash|refreshToken|passwordHash/iu);
  });

  it("summarizes pending approval count", () => {
    expect(getMobileLoginApprovalSummary(approvals)).toEqual({
      activeCountLabel: "1 bekleyen giriş isteği",
      emptyLabel: "Yeni cihazdan giriş isteği geldiğinde burada görünür."
    });
    expect(getMobileLoginApprovalSummary([]).activeCountLabel).toBe("Bekleyen giriş isteği yok");
  });
});

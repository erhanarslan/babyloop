import type { MobileLoginApprovalChallenge } from "../auth/auth-api";
import {
  buildMobileLoginApprovalPrompt,
  getCurrentMobileLoginApproval,
  mergeMobileLoginApprovalQueue,
  normalizeMobileLoginApprovalQueue,
  removeMobileLoginApprovalFromQueue
} from "./mobile-login-approval-model";

const approvals: MobileLoginApprovalChallenge[] = [
  {
    id: "approval-old",
    status: "pending",
    deviceLabel: "Eski tarayıcı",
    requestUserAgent: "Mozilla Old",
    requestIpAddress: "10.0.0.9",
    createdAt: "2026-07-04T00:58:00.000Z",
    expiresAt: "2026-07-04T01:08:00.000Z",
    resolvedAt: null
  },
  {
    id: "approval-1",
    status: "pending",
    deviceLabel: "Mac tarayıcı",
    requestUserAgent: "Mozilla BabyLoopWeb accessToken=secret-token",
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
    createdAt: "2026-07-04T01:01:00.000Z",
    expiresAt: "2026-07-04T01:11:00.000Z",
    resolvedAt: "2026-07-04T01:05:00.000Z"
  },
  {
    id: "approval-denied",
    status: "denied",
    deviceLabel: "Şüpheli tarayıcı",
    requestUserAgent: "Unknown Browser",
    requestIpAddress: "10.0.0.11",
    createdAt: "2026-07-04T01:02:00.000Z",
    expiresAt: "2026-07-04T01:12:00.000Z",
    resolvedAt: "2026-07-04T01:06:00.000Z"
  }
];

describe("mobile login approval prompt model", () => {
  it("normalizes only pending approvals and selects the newest one first", () => {
    const queue = normalizeMobileLoginApprovalQueue(approvals);

    expect(queue.map((approval) => approval.id)).toEqual(["approval-1", "approval-old"]);
    expect(getCurrentMobileLoginApproval(approvals)?.id).toBe("approval-1");
  });

  it("merges duplicate approval events without creating duplicate prompts", () => {
    const queue = normalizeMobileLoginApprovalQueue(approvals);
    const merged = mergeMobileLoginApprovalQueue(queue, {
      ...approvals[1],
      deviceLabel: "Mac tarayıcı güncel"
    });

    expect(merged.map((approval) => approval.id)).toEqual(["approval-1", "approval-old"]);
    expect(merged[0]?.deviceLabel).toBe("Mac tarayıcı güncel");
  });

  it("removes resolved approval requests from the prompt queue", () => {
    const queue = normalizeMobileLoginApprovalQueue(approvals);

    expect(removeMobileLoginApprovalFromQueue(queue, "approval-1").map((approval) => approval.id)).toEqual([
      "approval-old"
    ]);
    expect(mergeMobileLoginApprovalQueue(queue, { ...approvals[1], status: "denied" }).map((approval) => approval.id))
      .toEqual(["approval-old"]);
  });

  it("builds a safe prompt display model without raw IP, token, hash, or expiry details", () => {
    const prompt = buildMobileLoginApprovalPrompt(approvals[1]);

    expect(prompt).toMatchObject({
      id: "approval-1",
      title: "Yeni giriş isteği",
      description: "Hesabına başka bir cihazdan giriş yapılmak isteniyor.",
      deviceLabel: "Mac tarayıcı",
      approveLabel: "Onayla",
      denyLabel: "Reddet"
    });
    expect(prompt.createdAtLabel).toContain("İstek zamanı:");
    expect(JSON.stringify(prompt)).not.toMatch(/10\.0\.0\.10|secret-token|approvalToken|refreshToken|passwordHash|expiresAt|Son geçerlilik/iu);
  });
});

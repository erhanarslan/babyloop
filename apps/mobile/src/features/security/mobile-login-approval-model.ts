import type { MobileLoginApprovalChallenge } from "../auth/auth-api";

export type MobileLoginApprovalPrompt = {
  id: string;
  title: string;
  description: string;
  deviceLabel: string;
  deviceMeta: string;
  createdAtLabel: string;
  approveLabel: string;
  denyLabel: string;
};

export function normalizeMobileLoginApprovalQueue(
  approvals: MobileLoginApprovalChallenge[]
): MobileLoginApprovalChallenge[] {
  return sortPendingApprovals(approvals.filter((approval) => approval.status === "pending"));
}

export function mergeMobileLoginApprovalQueue(
  current: MobileLoginApprovalChallenge[],
  approval: MobileLoginApprovalChallenge
): MobileLoginApprovalChallenge[] {
  const withoutDuplicate = current.filter((currentApproval) => currentApproval.id !== approval.id);

  if (approval.status !== "pending") {
    return sortPendingApprovals(withoutDuplicate);
  }

  return sortPendingApprovals([approval, ...withoutDuplicate]);
}

export function removeMobileLoginApprovalFromQueue(
  current: MobileLoginApprovalChallenge[],
  approvalId: string
): MobileLoginApprovalChallenge[] {
  return current.filter((approval) => approval.id !== approvalId);
}

export function getCurrentMobileLoginApproval(
  approvals: MobileLoginApprovalChallenge[]
): MobileLoginApprovalChallenge | null {
  return normalizeMobileLoginApprovalQueue(approvals)[0] ?? null;
}

export function buildMobileLoginApprovalPrompt(
  approval: MobileLoginApprovalChallenge
): MobileLoginApprovalPrompt {
  return {
    id: approval.id,
    title: "Yeni giriş isteği",
    description: "Hesabına başka bir cihazdan giriş yapılmak isteniyor.",
    deviceLabel: safePromptText(approval.deviceLabel, "Bilinmeyen cihaz"),
    deviceMeta: safePromptText(approval.requestUserAgent, "Cihaz bilgisi sınırlı"),
    createdAtLabel: `İstek zamanı: ${formatApprovalDate(approval.createdAt)}`,
    approveLabel: "Onayla",
    denyLabel: "Reddet"
  };
}

function sortPendingApprovals(
  approvals: MobileLoginApprovalChallenge[]
): MobileLoginApprovalChallenge[] {
  return [...approvals]
    .filter((approval) => approval.status === "pending")
    .sort((left, right) => getDateTime(right.createdAt) - getDateTime(left.createdAt));
}

function getDateTime(value: string): number {
  const time = new Date(value).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function formatApprovalDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Bilinmiyor";
  }

  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit"
  });
}

function safePromptText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed
    .replace(/accessToken["':=\s]+[A-Za-z0-9._-]+/giu, "accessToken=[redacted]")
    .replace(/refreshToken["':=\s]+[A-Za-z0-9._-]+/giu, "refreshToken=[redacted]")
    .replace(/approvalToken["':=\s]+[A-Za-z0-9._-]+/giu, "approvalToken=[redacted]")
    .replace(/passwordHash["':=\s]+[A-Za-z0-9._-]+/giu, "passwordHash=[redacted]")
    .slice(0, 120);
}

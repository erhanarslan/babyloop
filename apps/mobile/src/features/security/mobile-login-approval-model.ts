import type { MobileLoginApprovalChallenge } from "../auth/auth-api";

export type MobileLoginApprovalPrompt = {
  id: string;
  title: string;
  deviceLabel: string;
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
    deviceLabel: safePromptText(approval.deviceLabel, "Bilinmeyen cihaz"),
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
    .replace(/access(?:Token)["':=\s]+[A-Za-z0-9._-]+/giu, "token [redacted]")
    .replace(/refresh(?:Token)["':=\s]+[A-Za-z0-9._-]+/giu, "token [redacted]")
    .replace(/approval(?:Token)["':=\s]+[A-Za-z0-9._-]+/giu, "approval [redacted]")
    .replace(/password(?:Hash)["':=\s]+[A-Za-z0-9._-]+/giu, "password [redacted]")
    .slice(0, 120);
}

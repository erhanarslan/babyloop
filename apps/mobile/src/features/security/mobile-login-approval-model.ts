import type { MobileLoginApprovalChallenge } from "../auth/auth-api";

export type MobileLoginApprovalCard = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  approveLabel: string;
  denyLabel: string;
};

export type MobileLoginApprovalSummary = {
  activeCountLabel: string;
  emptyLabel: string;
};

export function buildMobileLoginApprovalCards(
  approvals: MobileLoginApprovalChallenge[]
): MobileLoginApprovalCard[] {
  return approvals
    .filter((approval) => approval.status === "pending")
    .map((approval) => ({
      id: approval.id,
      title: approval.deviceLabel,
      subtitle: buildApprovalSubtitle(approval),
      meta: `İstek: ${formatApprovalDate(approval.createdAt)} · Son geçerlilik: ${formatApprovalDate(approval.expiresAt)}`,
      approveLabel: "Onayla",
      denyLabel: "Reddet"
    }));
}

export function getMobileLoginApprovalSummary(
  approvals: MobileLoginApprovalChallenge[]
): MobileLoginApprovalSummary {
  const pendingCount = approvals.filter((approval) => approval.status === "pending").length;

  return {
    activeCountLabel: pendingCount === 0 ? "Bekleyen giriş isteği yok" : `${pendingCount} bekleyen giriş isteği`,
    emptyLabel: "Yeni cihazdan giriş isteği geldiğinde burada görünür."
  };
}

function buildApprovalSubtitle(approval: MobileLoginApprovalChallenge): string {
  const parts = [
    approval.requestIpAddress ? `IP: ${approval.requestIpAddress}` : null,
    approval.requestUserAgent ? approval.requestUserAgent : null
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Cihaz bilgisi sınırlı";
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

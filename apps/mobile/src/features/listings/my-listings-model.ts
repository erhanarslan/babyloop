import type { MobileListingStatus } from "./listings-api";

export type MobileListingStatusAction = {
  label: string;
  status: MobileListingStatus;
  tone: "primary" | "secondary" | "danger";
};

export function getMobileListingStatusActions(
  currentStatus: string | null | undefined
): MobileListingStatusAction[] {
  switch (currentStatus) {
    case "active":
      return [
        {
          label: "Satıldı yap",
          status: "sold",
          tone: "primary"
        },
        {
          label: "Arşivle",
          status: "archived",
          tone: "secondary"
        }
      ];

    case "reserved":
      return [
        {
          label: "Aktife al",
          status: "active",
          tone: "secondary"
        },
        {
          label: "Satıldı yap",
          status: "sold",
          tone: "primary"
        },
        {
          label: "Arşivle",
          status: "archived",
          tone: "secondary"
        }
      ];

    case "sold":
      return [
        {
          label: "Arşivle",
          status: "archived",
          tone: "secondary"
        }
      ];

    case "archived":
      return [
        {
          label: "Yeniden aktif et",
          status: "active",
          tone: "primary"
        }
      ];

    default:
      return [];
  }
}

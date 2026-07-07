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
          label: "Satıldı",
          status: "sold",
          tone: "primary"
        },
        {
          label: "Yayından kaldır",
          status: "archived",
          tone: "secondary"
        }
      ];

    case "reserved":
      return [
        {
          label: "Yayına al",
          status: "active",
          tone: "secondary"
        },
        {
          label: "Satıldı",
          status: "sold",
          tone: "primary"
        },
        {
          label: "Yayından kaldır",
          status: "archived",
          tone: "secondary"
        }
      ];

    case "sold":
      return [
        {
          label: "Yayından kaldır",
          status: "archived",
          tone: "secondary"
        }
      ];

    case "archived":
      return [
        {
          label: "Yayına al",
          status: "active",
          tone: "primary"
        }
      ];

    default:
      return [];
  }
}

import type {
  MobileChildProfile,
  MobileChildProfileNotificationCadence
} from "../child/child-reminders-api";
import { formatCadence } from "../child/child-reminders-model";

export type MobileNotificationPreferenceCadenceOption = {
  cadence: MobileChildProfileNotificationCadence;
  title: string;
  description: string;
};

export const mobileNotificationPreferenceCadenceOptions: readonly MobileNotificationPreferenceCadenceOption[] = [
  {
    cadence: "monthly",
    title: "Aylık",
    description: "Çocuğun yaş dönemine göre pratik ürün ihtiyacı taslakları."
  },
  {
    cadence: "yearly",
    title: "Yıllık",
    description: "Daha seyrek, büyük dönem geçişleri için öneri taslakları."
  },
  {
    cadence: "off",
    title: "Kapalı",
    description: "Çocuk profili öneri bildirimlerini durdurur."
  }
];

export function getPreferredMobileNotificationChildProfile(
  childProfiles: MobileChildProfile[]
): MobileChildProfile | null {
  return childProfiles.find((profile) => profile.isActive) ?? childProfiles[0] ?? null;
}

export function getMobileNotificationPreferenceDeliveryBoundaryText(): string {
  return "Bu ekran gerçek push gönderimi yapmaz; çocuk profili öneri sıklığını ve uygulama içi hatırlatıcı durumunu yönetir.";
}

export function getMobileNotificationPreferenceProfileLabel(
  input: {
    isLoading: boolean;
    childProfile: Pick<MobileChildProfile, "label"> | null;
  }
): string {
  if (input.isLoading) {
    return "Yükleniyor...";
  }

  if (!input.childProfile) {
    return "Aktif çocuk profili yok";
  }

  return `Aktif profil: ${input.childProfile.label}`;
}

export function getMobileNotificationCadenceUpdateMessage(
  cadence: MobileChildProfileNotificationCadence
): string {
  return `Bildirim sıklığı ${formatCadence(cadence).toLocaleLowerCase("tr-TR")} olarak güncellendi.`;
}

export function canUpdateMobileNotificationCadence(
  childProfile: Pick<MobileChildProfile, "id"> | null,
  isUpdating: boolean
): childProfile is Pick<MobileChildProfile, "id"> {
  return childProfile !== null && !isUpdating;
}

export function isMobileNotificationCadenceSelected(
  childProfile: Pick<MobileChildProfile, "notificationCadence"> | null,
  cadence: MobileChildProfileNotificationCadence
): boolean {
  return childProfile?.notificationCadence === cadence;
}

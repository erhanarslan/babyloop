import type {
  MobileChildProfile,
  MobileChildProfileNotificationCadence
} from "../child/child-reminders-api";
import { formatCadence } from "../child/child-reminders-model";
import type {
  MobileNotificationPreference,
  MobileNotificationPreferencesPayload
} from "./notifications-api";

export type MobileMarketplaceEmailPreferenceSource = "messages" | "listing";

export const mobileMarketplaceEmailPreferenceDefinitions: ReadonlyArray<{
  source: MobileMarketplaceEmailPreferenceSource;
  title: string;
  description: string;
}> = [
  {
    source: "messages",
    title: "Yeni mesaj e-postaları",
    description: "Yeni mesaj geldiğinde e-posta al. Mesajın içeriği e-postaya eklenmez."
  },
  {
    source: "listing",
    title: "Favoriye eklenme e-postaları",
    description: "İlanlarından biri favoriye eklendiğinde e-posta al."
  }
];

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
  return "Bu ekran bildirim tercihlerini yönetir. Email, push ve n8n gönderimi sunucu provider ayarları, izinler ve tercih durumuna göre notification processor tarafından yürütülür.";
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

export function getMobileNotificationPreferenceChannelSummary(
  payload: MobileNotificationPreferencesPayload | null
): string {
  if (!payload) {
    return "Kaynak ve kanal tercihleri yüklenmedi.";
  }

  const activeCount = payload.preferences.filter((preference) => preference.enabled).length;
  const draftOnlyChannels = payload.summary.draftOnlyChannels.join(", ");

  return `${activeCount} tercih aktif. Provider kanalları sunucu ayarları ve izinler uygun olduğunda işlenir; draft-only kanallar: ${draftOnlyChannels}.`;
}

export function canUseMobileNotificationProviderDelivery(
  payload: MobileNotificationPreferencesPayload | null
): boolean {
  return payload?.summary.emailProviderEnabled === true;
}

export function findMobileMarketplaceEmailPreference(
  payload: MobileNotificationPreferencesPayload | null,
  source: MobileMarketplaceEmailPreferenceSource
): MobileNotificationPreference | null {
  return payload?.preferences.find((item) => item.source === source && item.channel === "email") ?? null;
}

export function replaceMobileNotificationPreference(
  payload: MobileNotificationPreferencesPayload,
  preference: MobileNotificationPreference
): MobileNotificationPreferencesPayload {
  return {
    ...payload,
    preferences: payload.preferences.map((item) => (
      item.source === preference.source && item.channel === preference.channel ? preference : item
    ))
  };
}

const LABELS: Record<string, string> = {
  active: "Aktif",
  answer: "Yanıt",
  archived: "Arşivlendi",
  blocked: "Engellendi",
  candidate: "Bekliyor",
  child_lifecycle: "Çocuk yaşam döngüsü",
  child_profile: "Çocuk profili",
  child_reminder: "Çocuk hatırlatıcısı",
  critical: "Kritik",
  created: "Oluşturuldu",
  dismissed: "Kapatıldı",
  disabled: "Devre dışı",
  email: "E-posta",
  email_draft: "E-posta taslağı",
  expo: "Expo",
  failed: "Başarısız",
  first_report_for_target: "Hedef için ilk şikâyet",
  hidden: "Gizli",
  high: "Yüksek",
  in_app: "Uygulama içi",
  in_review: "İncelemede",
  indexed: "Dizine eklendi",
  like_new: "Yeni gibi",
  listing: "İlan",
  listing_hide: "İlanı gizle",
  listing_restore: "İlanı geri yükle",
  listing_favorited: "İlan favorilendi",
  login_approval: "Giriş onayı",
  low: "Düşük",
  live: "Canlı",
  medium: "Orta",
  message: "Mesaj",
  message_hide: "Mesajı gizle",
  message_mark_reviewed: "Mesajı incelendi olarak işaretle",
  message_received: "Mesaj alındı",
  missing: "Eksik",
  mock: "Taklit",
  n8n: "n8n",
  none: "Yok",
  normal: "Normal",
  needs_review: "İnceleme gerekli",
  pending: "Bekliyor",
  pending_review: "İnceleme bekliyor",
  processing: "İşleniyor",
  profile: "Profil",
  profile_restore: "Profili geri yükle",
  profile_restrict: "Profili kısıtla",
  profile_suspend: "Profili askıya al",
  profile_warn: "Profili uyar",
  push: "Anlık bildirim",
  reindex_required: "Yeniden dizinleme gerekli",
  reported_message: "Şikâyet edilen mesaj",
  reserved: "Rezerve",
  restricted: "Kısıtlı",
  resolved: "Çözüldü",
  rejected: "Reddedildi",
  sale: "Satılık",
  saved_search: "Kayıtlı arama",
  search: "Arama",
  security: "Güvenlik",
  sent: "Gönderildi",
  skipped: "Atlandı",
  sold: "Satıldı",
  stale: "Güncel değil",
  success: "Başarılı",
  suspended: "Askıya alındı",
  unknown: "Bilinmiyor",
  unavailable: "Kullanılamıyor",
  unsafe_message: "Güvensiz mesaj",
  web: "Web",
  mobile: "Mobil"
};

export function formatEnumLabel(value: string | null | undefined): string {
  if (!value) return "Belirtilmedi";
  return LABELS[value.toLowerCase()] ?? value.replaceAll("_", " ");
}

export function formatDateTimeTr(value: string | Date | null | undefined): string {
  if (!value) return "Belirtilmedi";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Geçersiz tarih";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul"
  }).format(date);
}

export function formatDateTr(value: string | Date | null | undefined): string {
  if (!value) return "Belirtilmedi";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Geçersiz tarih";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeZone: "Europe/Istanbul"
  }).format(date);
}

export function formatMaskedReference(value: string | null | undefined): string {
  if (!value) return "Sağlayıcı kabul etti";
  if (value.length <= 10) return value;
  return `${value.slice(0, 5)}…${value.slice(-4)}`;
}

import type { BackofficeAnalyticsOverview } from "./analytics-api";

export type AnalyticsKpiCard = {
  label: string;
  value: string;
  details: string[];
  period: string;
  source: string;
};

export function buildAnalyticsOverviewKpis(
  overview: BackofficeAnalyticsOverview
): AnalyticsKpiCard[] {
  return [
    {
      label: "Kullanıcılar",
      value: String(overview.totalRegisteredUsers),
      details: [
        `${overview.verifiedUsers} doğrulanmış (%${overview.verifiedRate})`,
        `${overview.activeCustomerUsers} aktif gerçek kullanıcı`,
        `${overview.demoSystemAccounts} demo/sistem hesabı`
      ],
      period: "Hesap görünümü ve seçili dönem",
      source: "Kullanıcılar + ham olaylar"
    },
    {
      label: "Kimlik doğrulama",
      value: `${overview.registrations} kayıt`,
      details: [
        `${overview.successfulLogins} başarılı · ${overview.failedLogins} başarısız giriş`,
        `${overview.emailVerifications} e-posta doğrulaması · ${overview.mfaCompletions} MFA tamamlama`,
        `${overview.googleSuccessfulLogins} Google girişi · ${overview.googleLinkedUsers} bağlı hesap`
      ],
      period: "Son 30 gün ve güncel hesap görünümü",
      source: "Ham kimlik olayları + kimlik hesapları"
    },
    {
      label: "Etkileşim",
      value: `${overview.sessions} oturum`,
      details: [
        `${overview.pageViews + overview.screenViews} sayfa/ekran görüntüleme`,
        `${overview.activeUsers} tekil ziyaretçi`,
        `Ortalama ${formatDuration(overview.averageSessionEngagementMs)}`
      ],
      period: "Son 30 gün",
      source: "Ham analitik olayları"
    },
    {
      label: "Pazaryeri",
      value: `${overview.listingViews} ilan görüntüleme`,
      details: [
        `${overview.uniqueListingViewers} tekil izleyici`,
        `${overview.favoriteUsers} favorileyen`,
        `${overview.searches} arama · ${overview.contactIntents} iletişim niyeti`
      ],
      period: "Son 30 gün",
      source: "Ham analitik olayları"
    },
    {
      label: "Mesajlaşma",
      value: `${overview.conversationsStarted} konuşma`,
      details: [
        `${overview.messagesSent} gönderilen mesaj`,
        `${overview.messagesRead} okundu işareti`,
        `${overview.activeMessagingParticipants} etkin katılımcı`
      ],
      period: "Son 30 gün",
      source: "Ham analitik olayları"
    },
    {
      label: "Asistan ve RAG",
      value: `${overview.assistantUsers} kullanıcı`,
      details: [
        `${overview.assistantQuestions} soru`,
        `${overview.assistantAnswers} yanıt`,
        `${overview.assistantErrors} güvenli hata · %${overview.assistantGroundedRate} kaynaklı yanıt`
      ],
      period: "Son 30 gün",
      source: "Standart asistan olayları"
    },
    {
      label: "Çocuk özellikleri",
      value: `${overview.childProfilesCreated} profil oluşturma`,
      details: [
        `${overview.childNotesCreated} not oluşturma`,
        `${overview.childRemindersCreated} hatırlatıcı oluşturma`,
        "Not ve hatırlatıcı içeriği ölçümlere taşınmaz"
      ],
      period: "Son 30 gün",
      source: "Ham gizlilik güvenli çocuk özelliği olayları"
    }
  ];
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0 sn";
  }

  const seconds = Math.round(ms / 1000);

  if (seconds < 60) {
    return `${seconds} sn`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes} dk ${remainingSeconds} sn` : `${minutes} dk`;
}

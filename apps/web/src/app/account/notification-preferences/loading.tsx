import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function NotificationPreferencesLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Bildirim tercihleri yükleniyor"
          description="Mesaj ve ilan hareketleri için e-posta tercihlerin hazırlanıyor."
        />
        <LoadingBlock
          title="Bildirim tercihleri yükleniyor"
          message="E-posta bildirim ayarların kontrol ediliyor."
        />
      </PageContainer>
    </SiteShell>
  );
}

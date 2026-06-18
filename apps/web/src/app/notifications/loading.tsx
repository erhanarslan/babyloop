import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";

export default function NotificationsLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Bildirimler"
          description="Mesaj ve ilan hareketleri hazırlanıyor."
        />
        <LoadingBlock
          title="Bildirimler yükleniyor"
          message="Mesaj ve ilan hareketleri hazırlanıyor."
        />
      </PageContainer>
    </SiteShell>
  );
}

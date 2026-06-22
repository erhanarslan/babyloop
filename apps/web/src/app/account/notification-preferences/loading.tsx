import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function NotificationPreferencesLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Bildirim tercihleri yükleniyor"
          description="Çocuk profili ve kayıtlı arama bildirim tercihleri hazırlanıyor."
        />
        <LoadingBlock
          title="Bildirim tercihleri yükleniyor"
          message="Tercihlerin ve bildirim taslakların hazırlanıyor."
        />
      </PageContainer>
    </SiteShell>
  );
}

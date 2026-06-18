import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function AccountPasswordLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Güvenlik ve şifre"
          description="Şifre ayarları hazırlanıyor."
        />
        <LoadingBlock
          title="Şifre ayarları yükleniyor"
          message="Güvenlik bilgileri hazırlanıyor."
        />
      </PageContainer>
    </SiteShell>
  );
}

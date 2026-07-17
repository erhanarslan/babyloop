import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function AccountPasswordLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Şifre değiştir"
          description="Şifre değiştirme alanı hazırlanıyor."
        />
        <LoadingBlock
          title="Şifre formu yükleniyor"
          message="Hesap bilgileri hazırlanıyor."
        />
      </PageContainer>
    </SiteShell>
  );
}

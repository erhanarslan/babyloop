import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function AccountSecurityLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="Hesap güvenliği"
          title="Güvenlik merkezi"
          description="Şifre, OTP / MFA ve aktif oturum ayarların hazırlanıyor."
        />
        <LoadingBlock
          title="Güvenlik ayarları yükleniyor"
          message="Hesap güvenliği bilgilerin hazırlanıyor."
        />
      </PageContainer>
    </SiteShell>
  );
}

import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function SellerDashboardLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Satıcı paneli yükleniyor"
          description="İlanların ve temel satıcı bilgilerin hazırlanıyor."
        />
        <LoadingBlock
          title="Satıcı paneli yükleniyor"
          message="İlanların ve temel satıcı bilgilerin hazırlanıyor."
        />
      </PageContainer>
    </SiteShell>
  );
}

import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";

export default function MyListingsLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="İlanların yükleniyor"
          description="İlanların ve işlem seçeneklerin hazırlanıyor."
        />
        <LoadingBlock
          title="İlanların yükleniyor"
          message="İlanların ve işlem seçeneklerin hazırlanıyor."
        />
      </PageContainer>
    </SiteShell>
  );
}

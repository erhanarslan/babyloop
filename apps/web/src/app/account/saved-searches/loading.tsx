import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function SavedSearchesLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Kayıtlı aramalar yükleniyor"
          description="Kaydettiğin arama filtreleri hazırlanıyor."
        />
        <LoadingBlock
          title="Kayıtlı aramalar yükleniyor"
          message="Kaydettiğin arama filtreleri hazırlanıyor."
        />
      </PageContainer>
    </SiteShell>
  );
}

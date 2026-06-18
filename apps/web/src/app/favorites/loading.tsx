import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";

export default function FavoritesLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Favoriler yükleniyor"
          description="Kaydettiğin ilanlar hazırlanıyor."
        />
        <LoadingBlock
          title="Favoriler yükleniyor"
          message="Kaydettiğin ilanlar hazırlanıyor."
        />
      </PageContainer>
    </SiteShell>
  );
}

import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function ConversationThreadLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Konuşma yükleniyor"
          description="Seçili konuşma hazırlanıyor."
        />
        <LoadingBlock
          title="Konuşma yükleniyor"
          message="Seçili konuşma hazırlanıyor."
        />
      </PageContainer>
    </SiteShell>
  );
}

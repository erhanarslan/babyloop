import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";

export default function ConversationsLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Mesajlar yükleniyor"
          description="Konuşmaların hazırlanıyor."
        />
        <LoadingBlock
          title="Mesajlar yükleniyor"
          message="Konuşmaların hazırlanıyor."
        />
      </PageContainer>
    </SiteShell>
  );
}

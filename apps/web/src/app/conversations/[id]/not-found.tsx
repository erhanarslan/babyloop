import { EmptyState, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function ConversationNotFound() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Konuşma bulunamadı"
          description="Bu konuşma kapalı, engellenmiş veya artık erişimine açık olmayabilir."
        />
        <EmptyState
          title="Konuşma bulunamadı"
          message="Bu konuşma kapalı, engellenmiş veya artık erişimine açık olmayabilir."
          actionHref="/conversations"
          actionLabel="Mesajlara dön"
        />
      </PageContainer>
    </SiteShell>
  );
}

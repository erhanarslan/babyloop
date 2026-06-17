import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function AccountChildrenLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Çocuğum yükleniyor"
          description="Çocuk bilgileri hazırlanıyor."
        />
        <LoadingBlock
          title="Çocuğum yükleniyor"
          message="Çocuk bilgileri hazırlanıyor."
        />
      </PageContainer>
    </SiteShell>
  );
}

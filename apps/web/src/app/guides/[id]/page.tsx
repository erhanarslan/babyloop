import { notFound } from "next/navigation";
import { SiteShell } from "../../../components/ui";
import { ParentGuideDetailPageContent } from "../../../features/parent-guides/parent-guide-detail-page-content";
import { getParentGuideTopicById } from "../../../features/parent-guides/parent-guide-data";

type GuideDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function GuideDetailPage({ params }: GuideDetailPageProps) {
  const { id } = await params;
  const topic = getParentGuideTopicById(id);

  if (!topic) {
    notFound();
  }

  return (
    <SiteShell>
      <ParentGuideDetailPageContent topic={topic} />
    </SiteShell>
  );
}

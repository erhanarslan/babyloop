import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "../../../components/ui";
import { ParentGuideDetailPageContent } from "../../../features/parent-guides/parent-guide-detail-page-content";
import { getParentGuideTopicById } from "../../../features/parent-guides/parent-guide-data";
import { buildNoIndexMetadata, buildPublicPageMetadata } from "../../../lib/seo";

type GuideDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({ params }: GuideDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const topic = getParentGuideTopicById(id);

  if (!topic) {
    return buildNoIndexMetadata(
      "Parent guide unavailable",
      "This BabyLoop parent guide could not be found."
    );
  }

  return buildPublicPageMetadata({
    title: topic.title,
    description: topic.summary,
    path: `/guides/${topic.id}`
  });
}

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

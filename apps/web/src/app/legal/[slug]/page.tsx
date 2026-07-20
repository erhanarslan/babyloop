import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "../../../components/ui";
import {
  LEGAL_DOCUMENTS,
  LEGAL_DOCUMENT_SLUGS,
  isLegalDocumentSlug
} from "../../../features/legal/legal-documents";
import { LegalDocumentPage } from "../../../features/legal/legal-page";
import { buildCanonicalUrl } from "../../../lib/seo";

export function generateStaticParams() {
  return LEGAL_DOCUMENT_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  if (!isLegalDocumentSlug(slug)) {
    return {};
  }

  const document = LEGAL_DOCUMENTS[slug];

  return {
    title: document.title,
    description: document.description,
    alternates: { canonical: buildCanonicalUrl(`/legal/${slug}`) }
  };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!isLegalDocumentSlug(slug)) {
    notFound();
  }

  return (
    <SiteShell>
      <LegalDocumentPage slug={slug} />
    </SiteShell>
  );
}

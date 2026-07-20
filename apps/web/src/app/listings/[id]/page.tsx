import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { SiteShell } from "../../../components/ui";
import {
  ListingDetailContent,
  ListingDetailUnavailable
} from "../../../features/listings/listing-detail-content";
import {
  fetchApi,
  getApiBaseUrl,
  type ListingDetailPayload
} from "../../../lib/api";
import {
  buildListingBreadcrumbJsonLd,
  buildListingJsonLd,
  buildListingMetadata,
  buildNoIndexMetadata,
  isListingIndexable,
  serializeStructuredData
} from "../../../lib/seo";

export const dynamic = "force-dynamic";

const fetchPublicListingDetail = cache((id: string) =>
  fetchApi<ListingDetailPayload>(`/api/v1/listings/${id}`)
);

type ListingDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({ params }: ListingDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await fetchPublicListingDetail(id);

  if (!result.ok) {
    return buildNoIndexMetadata(
      "Listing unavailable",
      "This BabyLoop listing is not available."
    );
  }

  return buildListingMetadata(result.data.listing);
}

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { id } = await params;
  const result = await fetchPublicListingDetail(id);

  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") {
      notFound();
    }

    return (
      <SiteShell>
        <ListingDetailUnavailable error={result.error} />
      </SiteShell>
    );
  }

  const { listing } = result.data;
  const shouldRenderStructuredData = isListingIndexable(listing);
  const listingJsonLd = shouldRenderStructuredData ? buildListingJsonLd(listing) : null;
  const breadcrumbJsonLd = shouldRenderStructuredData ? buildListingBreadcrumbJsonLd(listing) : null;

  return (
    <>
      {listingJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeStructuredData(listingJsonLd)
          }}
        />
      ) : null}
      {breadcrumbJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeStructuredData(breadcrumbJsonLd)
          }}
        />
      ) : null}
      <SiteShell>
        <ListingDetailContent apiBaseUrl={getApiBaseUrl()} listing={listing} />
      </SiteShell>
    </>
  );
}

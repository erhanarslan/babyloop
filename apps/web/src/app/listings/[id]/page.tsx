import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageContainer, PageHeading, SiteShell } from "../../../components/ui";
import { FavoriteButton } from "../../../features/favorites/favorite-button";
import { MessageSellerButton } from "../../../features/messaging/message-seller-button";
import {
  fetchApi,
  getApiBaseUrl,
  type ListingDetailPayload
} from "../../../lib/api";

export const dynamic = "force-dynamic";

type ListingDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { id } = await params;
  const result = await fetchApi<ListingDetailPayload>(`/api/v1/listings/${id}`);

  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") {
      notFound();
    }

    return (
      <SiteShell>
        <PageHeading
          eyebrow="Listing detail"
          title="Listing unavailable"
          description={result.error.message}
        />
        <PageContainer>
          <Link className="primary-link" href="/browse">
            Back to browse
          </Link>
        </PageContainer>
      </SiteShell>
    );
  }

  const { listing } = result.data;

  return (
    <SiteShell>
      <PageContainer className="detail-layout">
        <div className="detail-media">
          {listing.images.length > 0 ? (
            listing.images.map((image) => (
              <div className="image-metadata" key={image.id}>
                <strong>Image metadata</strong>
                <span>{image.url}</span>
              </div>
            ))
          ) : (
            <EmptyState
              title="No images yet."
              message="Image upload and processing will come in a later phase."
            />
          )}
        </div>

        <article className="detail-panel">
          <Link className="back-link" href="/browse">
            Back to browse
          </Link>
          <p className="listing-meta">{listing.category.name}</p>
          <h1>{listing.title}</h1>
          <strong className="detail-price">{formatPrice(listing.price)}</strong>
          <p className="detail-description">
            {listing.description ?? "No description provided yet."}
          </p>
          <FavoriteButton
            apiBaseUrl={getApiBaseUrl()}
            initiallyFavorited={false}
            listingId={listing.id}
          />
          <MessageSellerButton
            apiBaseUrl={getApiBaseUrl()}
            listingId={listing.id}
            sellerProfileId={listing.seller.id}
          />

          <dl className="detail-facts">
            <div>
              <dt>Seller</dt>
              <dd>{listing.seller.displayName}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{listing.seller.locationCity ?? "Not provided"}</dd>
            </div>
            <div>
              <dt>Condition</dt>
              <dd>{formatLabel(listing.condition)}</dd>
            </div>
            <div>
              <dt>Listing type</dt>
              <dd>{formatLabel(listing.listingType)}</dd>
            </div>
          </dl>
        </article>
      </PageContainer>
    </SiteShell>
  );
}

function formatPrice(price: ListingDetailPayload["listing"]["price"]): string {
  if (!price) {
    return "Price on request";
  }

  return `${price.amount} ${price.currency}`;
}

function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}

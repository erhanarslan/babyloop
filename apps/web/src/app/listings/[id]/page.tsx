import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Card,
  EmptyState,
  PageContainer,
  PageHeading,
  SiteShell
} from "../../../components/ui";
import { FavoriteButton } from "../../../features/favorites/favorite-button";
import { ListingImageFrame } from "../../../features/listings/listing-image-frame";
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
            <div className="detail-gallery" aria-label="Listing image gallery">
              {listing.images.map((image, index) => (
                <ListingImageFrame
                  alt={`${listing.title} product image ${index + 1}`}
                  className={index === 0 ? "detail-image detail-image-primary" : "detail-image"}
                  fallbackLabel="Image unavailable"
                  key={image.id}
                  url={image.url}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No images yet."
              message="Image upload and processing will come in a later phase."
            />
          )}
        </div>

        <article className="detail-panel">
          <Link className="back-link" href="/browse">
            Browse listings
          </Link>
          <div className="listing-card-badges">
            <Badge>{listing.category.name}</Badge>
            <Badge tone="success">{formatLabel(listing.listingType)}</Badge>
            <Badge>{formatLabel(listing.condition)}</Badge>
          </div>
          <h1>{listing.title}</h1>
          <strong className="detail-price">{formatPrice(listing.price)}</strong>
          <p className="detail-description">
            {listing.description ?? "No description provided yet."}
          </p>

          <div className="detail-actions" aria-label="Listing actions">
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
          </div>

          <SellerCard listing={listing} />

          <dl className="detail-facts">
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
            <div>
              <dt>Created</dt>
              <dd>{formatDate(listing.createdAt)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDate(listing.updatedAt)}</dd>
            </div>
          </dl>
        </article>
      </PageContainer>
    </SiteShell>
  );
}

function SellerCard({ listing }: { listing: ListingDetailPayload["listing"] }) {
  return (
    <Card className="seller-card" aria-label="Seller information">
      <div className="seller-avatar" aria-hidden="true">
        {listing.seller.avatarUrl ? (
          <img src={listing.seller.avatarUrl} alt="" />
        ) : (
          <span>{listing.seller.displayName.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div>
        <p className="listing-meta">Seller</p>
        <h2>{listing.seller.displayName}</h2>
        <p className="muted">{listing.seller.locationCity ?? "Location not provided"}</p>
      </div>
    </Card>
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

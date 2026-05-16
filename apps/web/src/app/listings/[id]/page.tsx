import Link from "next/link";
import { notFound } from "next/navigation";
import { FavoriteButton } from "../../../features/favorites/favorite-button";
import { SiteHeader } from "../../../components/site-header";
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
      <main>
        <SiteHeader />
        <section className="section page-heading">
          <p className="eyebrow">Listing detail</p>
          <h1>Listing unavailable</h1>
          <p>{result.error.message}</p>
          <Link className="primary-link" href="/browse">
            Back to browse
          </Link>
        </section>
      </main>
    );
  }

  const { listing } = result.data;

  return (
    <main>
      <SiteHeader />

      <section className="section detail-layout">
        <div className="detail-media">
          {listing.images.length > 0 ? (
            listing.images.map((image) => (
              <div className="image-metadata" key={image.id}>
                <strong>Image metadata</strong>
                <span>{image.url}</span>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <h2>No images yet.</h2>
              <p>Image upload and processing will come in a later phase.</p>
            </div>
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
      </section>
    </main>
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

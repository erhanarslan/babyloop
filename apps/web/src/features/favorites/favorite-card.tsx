import Link from "next/link";
import type { FavoriteListing } from "../../lib/api";

type FavoriteCardProps = {
  favorite: FavoriteListing;
};

export function FavoriteCard({ favorite }: FavoriteCardProps) {
  return (
    <article className="listing-card">
      <div className="listing-card-body">
        <div>
          <p className="listing-meta">{favorite.category.name}</p>
          <h2>{favorite.title}</h2>
        </div>
        <p className="muted">Saved {new Date(favorite.favoritedAt).toLocaleDateString("en-US")}</p>
        <div className="listing-card-footer">
          <strong>{formatPrice(favorite.price)}</strong>
          <Link href={`/listings/${favorite.id}`}>View details</Link>
        </div>
      </div>
    </article>
  );
}

function formatPrice(price: FavoriteListing["price"]): string {
  if (!price) {
    return "Price on request";
  }

  return `${price.amount} ${price.currency}`;
}


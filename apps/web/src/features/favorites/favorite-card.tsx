"use client";

import Link from "next/link";
import type { FavoriteListing } from "../../lib/api";
import { useI18n } from "../../lib/i18n/i18n-provider";
import {
  formatCategoryName,
  formatDate,
  formatListingPrice
} from "../listings/listing-display";

type FavoriteCardProps = {
  favorite: FavoriteListing;
};

export function FavoriteCard({ favorite }: FavoriteCardProps) {
  const { dictionary, locale } = useI18n();
  const savedDate = dictionary.marketplace.savedDate.replace(
    "{date}",
    formatDate(favorite.favoritedAt, locale)
  );

  return (
    <article className="listing-card">
      <div className="listing-card-body">
        <div>
          <p className="listing-meta">{formatCategoryName(favorite.category, dictionary)}</p>
          <h2>{favorite.title}</h2>
        </div>
        <p className="muted">{savedDate}</p>
        <div className="listing-card-footer">
          <strong>{formatListingPrice(favorite.price, dictionary)}</strong>
          <Link href={`/listings/${favorite.id}`}>{dictionary.common.viewDetails}</Link>
        </div>
      </div>
    </article>
  );
}

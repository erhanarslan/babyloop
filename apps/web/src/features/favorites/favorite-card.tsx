"use client";

import Link from "next/link";
import { Badge, Button } from "../../components/ui";
import type { FavoriteListing } from "../../lib/api";
import { useI18n } from "../../lib/i18n/i18n-provider";
import {
  formatCategoryName,
  formatDate,
  formatListingCondition,
  formatListingPrice,
  formatListingStatus,
  formatListingType
} from "../listings/listing-display";

type FavoriteCardProps = {
  favorite: FavoriteListing;
  isPending: boolean;
  onRemove: () => void;
};

export function FavoriteCard({ favorite, isPending, onRemove }: FavoriteCardProps) {
  const { dictionary, locale } = useI18n();
  const categoryName = formatCategoryName(favorite.category, dictionary);
  const savedDate = dictionary.marketplace.savedDate.replace(
    "{date}",
    formatDate(favorite.favoritedAt, locale)
  );
  const isPublic = favorite.status === "active" || favorite.status === "reserved";
  const assistantPrompt = `Help me compare this BabyLoop favorite: ${favorite.title} in ${categoryName}. What should I check before messaging?`;

  return (
    <article className={`listing-card favorite-card favorite-card-decision${isPublic ? "" : " favorite-card-muted"}`}>
      <div className="listing-card-body">
        <div className="favorite-card-header">
          <div>
            <p className="listing-meta">{categoryName}</p>
            <h2>{favorite.title}</h2>
          </div>
          <Badge tone={isPublic ? "success" : "neutral"}>
            {formatListingStatus(favorite.status, dictionary)}
          </Badge>
        </div>

        <dl className="favorite-facts">
          <div>
            <dt>Price</dt>
            <dd>{formatListingPrice(favorite.price, dictionary)}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{formatListingType(favorite.listingType, dictionary)}</dd>
          </div>
          <div>
            <dt>Condition</dt>
            <dd>{formatListingCondition(favorite.condition, dictionary)}</dd>
          </div>
          <div>
            <dt>Saved</dt>
            <dd>{savedDate}</dd>
          </div>
        </dl>

        <div className={`favorite-decision-note${isPublic ? "" : " muted-state"}`}>
          <strong>{isPublic ? "Ready to compare" : "Review before acting"}</strong>
          <span>
            {isPublic
              ? "Open details, review photos, compare condition, and prepare seller questions before messaging."
              : "This saved listing may be sold, archived, or unavailable. Remove it if it no longer helps your decision."}
          </span>
        </div>

        <div className="favorite-next-actions">
          {isPublic ? (
            <Link href={`/listings/${favorite.id}`}>{dictionary.common.viewDetails}</Link>
          ) : (
            <span className="muted">{dictionary.listings.notPublic}</span>
          )}
          <Link href={`/categories/${favorite.category.slug}`}>Compare category</Link>
          <Link href={`/assistant?mode=safe_buying&prompt=${encodeURIComponent(assistantPrompt)}`}>
            Ask Assistant
          </Link>
          <Button
            variant="ghost"
            type="button"
            disabled={isPending}
            onClick={onRemove}
          >
            {isPending ? dictionary.marketplace.savingFavorite : dictionary.marketplace.unfavorite}
          </Button>
        </div>
      </div>
    </article>
  );
}

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
  apiBaseUrl: string;
  favorite: FavoriteListing;
  isPending: boolean;
  onRemove: () => void;
};

export function FavoriteCard({
  apiBaseUrl,
  favorite,
  isPending,
  onRemove
}: FavoriteCardProps) {
  const { dictionary, locale } = useI18n();
  const categoryName = formatCategoryName(favorite.category, dictionary);
  const savedDate = `${formatDate(favorite.favoritedAt, locale)} tarihinde kaydedildi`;
  const imageUrl = getSafeFavoriteImageUrl(
    favorite.firstImage?.url ?? favorite.images?.[0]?.url ?? null,
    apiBaseUrl
  );
  const isPublic = (favorite.status === "active" || favorite.status === "reserved") && Boolean(imageUrl);

  return (
    <article className="listing-card overflow-hidden">
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br from-primary/10 via-accent/30 to-secondary/40">
        {imageUrl ? (
          <img
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            src={imageUrl}
          />
        ) : (
          <div className="grid size-16 place-items-center rounded-full bg-background/80 text-2xl font-black text-primary shadow-sm">
            {categoryName.slice(0, 1).toLocaleUpperCase("tr-TR")}
          </div>
        )}
      </div>

      <div className="listing-card-body gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="listing-meta truncate">{categoryName}</p>
            <h2 className="line-clamp-2 text-lg font-black leading-snug">{favorite.title}</h2>
            <p className="mt-2 text-xl font-black text-foreground">
              {formatListingPrice(favorite.price, dictionary)}
            </p>
          </div>
          <Badge tone={isPublic ? "success" : "neutral"}>
            {formatListingStatus(favorite.status, dictionary)}
          </Badge>
        </div>

        <p className="text-sm font-semibold leading-6 text-muted-foreground">
          Durum: {formatListingCondition(favorite.condition, dictionary)} · Tip:{" "}
          {formatListingType(favorite.listingType, dictionary)}
        </p>
        <p className="text-xs font-bold text-muted-foreground">{savedDate}</p>

        <div className="mt-auto flex items-center gap-2 border-t border-border/60 pt-3">
          {isPublic ? (
            <Link
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-black text-primary-foreground"
              href={`/listings/${favorite.id}`}
            >
              {dictionary.common.viewDetails}
            </Link>
          ) : (
            <span className="inline-flex min-h-10 flex-1 items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-black text-muted-foreground">
              {dictionary.listings.notPublic}
            </span>
          )}
          <Button
            className="min-h-10 shrink-0 px-3"
            variant="ghost"
            type="button"
            disabled={isPending}
            onClick={onRemove}
            aria-label="Favoriden çıkar"
          >
            {isPending ? "Kaldırılıyor" : "Favoriden çıkar"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function getSafeFavoriteImageUrl(
  imageUrl: string | null | undefined,
  apiBaseUrl: string
): string | null {
  if (!imageUrl) {
    return null;
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  if (imageUrl.startsWith("/")) {
    return `${apiBaseUrl.replace(/\/$/, "")}${imageUrl}`;
  }

  return null;
}

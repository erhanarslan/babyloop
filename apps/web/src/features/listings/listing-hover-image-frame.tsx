
"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { usePageVisibility } from "../../lib/use-page-visibility";
import { ListingImageFrame } from "./listing-image-frame";

type ListingPreviewImage = {
  id: string;
  sortOrder: number;
  url: string;
};

type ListingHoverImageFrameProps = {
  alt: string;
  apiBaseUrl: string;
  className?: string;
  fallbackLabel: string;
  images: ListingPreviewImage[] | null | undefined;
};

const HOVER_IMAGE_INTERVAL_MS = 1200;
const MAX_HOVER_PREVIEW_IMAGES = 3;

export const ListingHoverImageFrame = memo(function ListingHoverImageFrame({
  alt,
  apiBaseUrl,
  className = "",
  fallbackLabel,
  images
}: ListingHoverImageFrameProps) {
  const previewImages = useMemo(() => normalizePreviewImages(images), [images]);
  const isPageVisible = usePageVisibility();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
    setIsHovering(false);
  }, [previewImages]);

  useEffect(() => {
    if (!isPageVisible || !isHovering || previewImages.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveImageIndex((currentIndex) => (currentIndex + 1) % previewImages.length);
    }, HOVER_IMAGE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isHovering, isPageVisible, previewImages.length]);

  function handleMouseEnter() {
    if (previewImages.length <= 1) {
      return;
    }

    setIsHovering(true);
  }

  function handleMouseLeave() {
    setIsHovering(false);
    setActiveImageIndex(0);
  }

  const activeImage = previewImages[activeImageIndex] ?? null;

  return (
    <div
      className={`listing-hover-image-frame${previewImages.length > 1 ? " has-multiple-images" : ""}`.trim()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <ListingImageFrame
        alt={alt}
        apiBaseUrl={apiBaseUrl}
        className={className}
        fallbackLabel={fallbackLabel}
        sizes="(max-width: 640px) 92vw, (max-width: 1024px) 45vw, 320px"
        url={activeImage?.url ?? null}
      />

      {previewImages.length > 1 ? (
        <div className="listing-hover-image-dots" aria-hidden="true">
          {previewImages.map((image, index) => (
            <span
              className={index === activeImageIndex ? "is-active" : ""}
              key={image.id}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
});

function normalizePreviewImages(
  images: ListingPreviewImage[] | null | undefined
): ListingPreviewImage[] {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .filter((image) => typeof image.url === "string" && image.url.trim().length > 0)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, MAX_HOVER_PREVIEW_IMAGES);
}

"use client";

import { useState } from "react";

type ListingImageFrameProps = {
  alt: string;
  className?: string;
  fallbackLabel?: string;
  url: string | null;
};

export function ListingImageFrame({
  alt,
  className = "",
  fallbackLabel = "No image",
  url
}: ListingImageFrameProps) {
  const [hasError, setHasError] = useState(false);

  if (!url || hasError) {
    return (
      <div className={`listing-image-fallback ${className}`.trim()} aria-label={fallbackLabel}>
        <span>{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <div className={`listing-image-frame ${className}`.trim()}>
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

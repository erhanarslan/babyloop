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
  const safeUrl = getSafeImageUrl(url);

  if (!safeUrl || hasError) {
    return (
      <div className={`listing-image-fallback ${className}`.trim()} aria-label={fallbackLabel}>
        <span>{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <div className={`listing-image-frame ${className}`.trim()}>
      <img
        src={safeUrl}
        alt={alt}
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

function getSafeImageUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);

    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

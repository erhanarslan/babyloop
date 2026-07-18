"use client";

import { useEffect, useState } from "react";

type ListingImageFrameProps = {
  alt: string;
  apiBaseUrl?: string;
  className?: string;
  fallbackLabel?: string;
  url: string | null;
};

export function ListingImageFrame({
  alt,
  apiBaseUrl,
  className = "",
  fallbackLabel = "Görsel yok",
  url
}: ListingImageFrameProps) {
  const [hasError, setHasError] = useState(false);
  const safeUrl = getSafeImageUrl(url, apiBaseUrl);

  useEffect(() => {
    setHasError(false);
  }, [safeUrl]);

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
        decoding="async"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

function getSafeImageUrl(url: string | null, apiBaseUrl?: string): string | null {
  if (!url) {
    return null;
  }

  if (url.startsWith("/api/v1/uploads/") && apiBaseUrl) {
    return `${apiBaseUrl}${url}`;
  }

  try {
    const parsedUrl = new URL(url);

    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

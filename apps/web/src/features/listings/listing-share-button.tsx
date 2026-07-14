"use client";

import { useState } from "react";
import { fetchWebListingShareLink } from "./listing-share-api";

type ListingShareButtonProps = {
  apiBaseUrl: string;
  listingId: string;
  title: string;
};

type ShareStatus = "idle" | "pending" | "copied" | "error";

export function ListingShareButton({
  apiBaseUrl,
  listingId,
  title
}: ListingShareButtonProps) {
  const [status, setStatus] = useState<ShareStatus>("idle");

  async function handleShareClick() {
    if (status === "pending") {
      return;
    }

    setStatus("pending");

    const fallbackUrl = buildBrowserListingUrl(listingId);

    try {
      const shareLink = await fetchWebListingShareLink(apiBaseUrl, listingId).catch(() => ({
        code: "",
        targetPath: `/listings/${encodeURIComponent(listingId)}`,
        url: fallbackUrl
      }));

      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          url: shareLink.url
        });

        setStatus("idle");
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareLink.url);
        setStatus("copied");
        window.setTimeout(() => setStatus("idle"), 1600);
        return;
      }

      window.prompt("İlan bağlantısı", shareLink.url);
      setStatus("idle");
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 1800);
    }
  }

  return (
    <button
      aria-label={status === "copied" ? "Bağlantı kopyalandı" : "İlanı paylaş"}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition hover:border-rose-200 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={status === "pending"}
      onClick={handleShareClick}
      title={status === "copied" ? "Kopyalandı" : "Paylaş"}
      type="button"
    >
      <ShareIcon />
      <span className="sr-only">
        {status === "copied" ? "Bağlantı kopyalandı" : "İlanı paylaş"}
      </span>
    </button>
  );
}

function buildBrowserListingUrl(listingId: string): string {
  const path = `/listings/${encodeURIComponent(listingId)}`;

  if (typeof window === "undefined") {
    return path;
  }

  return `${window.location.origin}${path}`;
}

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4" />
      <path d="m8.6 13.5 6.8 4" />
    </svg>
  );
}

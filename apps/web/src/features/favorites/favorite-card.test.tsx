import React, { type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FavoriteListing } from "../../lib/api";
import { FavoriteCard } from "./favorite-card";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => React.createElement("a", { className, href }, children)
}));

vi.mock("../../lib/i18n/i18n-provider", () => ({
  useI18n: () => ({
    dictionary: {
      common: {
        viewDetails: "Detayı görüntüle"
      },
      listings: {
        notPublic: "Yayında değil"
      }
    },
    locale: "tr"
  })
}));

vi.mock("../listings/listing-display", () => ({
  formatCategoryName: () => "Bebek Arabası",
  formatDate: () => "25.06.2026",
  formatListingCondition: () => "Yeni",
  formatListingPrice: () => "1.250 TL",
  formatListingStatus: (status: string) => {
    const labels: Record<string, string> = {
      active: "Aktif",
      reserved: "Rezerve",
      archived: "Arşiv",
      sold: "Satıldı"
    };

    return labels[status] ?? status;
  },
  formatListingType: () => "Satılık"
}));

function createFavorite(overrides: Partial<FavoriteListing> = {}): FavoriteListing {
  return {
    id: "30000000-0000-4000-8000-000000001001",
    isDemo: false,
    title: "Travel sistem bebek arabası",
    price: {
      amount: "1250.00",
      currency: "TRY"
    },
    status: "active",
    publicationState: "published",
    publishAfter: null,
    publishedAt: "2026-06-25T11:55:00.000Z",
    publicationReviewReason: null,
    listingType: "sale",
    condition: "new",
    locationCity: null,
    category: {
      id: "20000000-0000-4000-8000-000000000001",
      name: "Bebek Arabası",
      slug: "bebek-arabasi"
    },
    firstImage: {
      id: "40000000-0000-4000-8000-000000000001",
      url: "/uploads/listings/stroller.jpg",
      sortOrder: 0
    },
    images: [
      {
        id: "40000000-0000-4000-8000-000000000001",
        url: "/uploads/listings/stroller.jpg",
        sortOrder: 0
      }
    ],
    recommendedAgeMinMonths: null,
    recommendedAgeMaxMonths: null,
    favoritedAt: "2026-06-25T12:00:00.000Z",
    ...overrides
  };
}

function renderFavoriteCard(
  favorite: FavoriteListing,
  options: {
    isPending?: boolean;
    onRemove?: () => void;
  } = {}
) {
  const onRemove = options.onRemove ?? vi.fn();

  const view = render(
    React.createElement(FavoriteCard, {
      apiBaseUrl: "http://localhost:4000",
      favorite,
      isPending: options.isPending ?? false,
      onRemove
    })
  );

  return {
    ...view,
    onRemove
  };
}

describe("FavoriteCard", () => {
  it("renders a local listing image with the API base URL", () => {
    const favorite = createFavorite({
      firstImage: {
        id: "40000000-0000-4000-8000-000000000001",
        url: "/uploads/listings/stroller.jpg",
        sortOrder: 0
      },
      images: [
        {
          id: "40000000-0000-4000-8000-000000000001",
          url: "/uploads/listings/stroller.jpg",
          sortOrder: 0
        }
      ]
    });

    const { container } = renderFavoriteCard(favorite);
    const image = container.querySelector("img");

    expect(image).not.toBeNull();
    expect(image).toHaveAttribute(
      "src",
      "http://localhost:4000/uploads/listings/stroller.jpg"
    );
    expect(screen.getByText("Travel sistem bebek arabası")).toBeInTheDocument();
  });

  it("preserves absolute image URLs", () => {
    const favorite = createFavorite({
      firstImage: {
        id: "40000000-0000-4000-8000-000000000002",
        url: "https://cdn.example.test/listings/stroller.jpg",
        sortOrder: 0
      }
    });

    const { container } = renderFavoriteCard(favorite);
    const image = container.querySelector("img");

    expect(image).not.toBeNull();
    expect(image).toHaveAttribute(
      "src",
      "https://cdn.example.test/listings/stroller.jpg"
    );
  });

  it("renders the category placeholder when the favorite has no image", () => {
    const { container } = renderFavoriteCard(createFavorite({ firstImage: null, images: [] }));

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("Travel sistem bebek arabası")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Detayı görüntüle" })).not.toBeInTheDocument();
    expect(screen.getByText("Yayında değil")).toBeInTheDocument();
  });

  it("ignores unsafe non-url image values and falls back to the placeholder", () => {
    const favorite = createFavorite({
      firstImage: {
        id: "40000000-0000-4000-8000-000000000003",
        url: "javascript:alert(1)",
        sortOrder: 0
      }
    });

    const { container } = renderFavoriteCard(favorite);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("javascript:alert");
  });

  it("links to listing detail for active favorites", () => {
    renderFavoriteCard(createFavorite({ status: "active" }));

    const link = screen.getByRole("link", { name: "Detayı görüntüle" });

    expect(link).toHaveAttribute(
      "href",
      "/listings/30000000-0000-4000-8000-000000001001"
    );
    expect(screen.getByText("Aktif")).toBeInTheDocument();
  });

  it("links to listing detail for reserved favorites because reserved listings remain public", () => {
    renderFavoriteCard(createFavorite({ status: "reserved" }));

    const link = screen.getByRole("link", { name: "Detayı görüntüle" });

    expect(link).toHaveAttribute(
      "href",
      "/listings/30000000-0000-4000-8000-000000001001"
    );
    expect(screen.getByText("Rezerve")).toBeInTheDocument();
  });

  it("hides the detail link for inactive favorites", () => {
    renderFavoriteCard(createFavorite({ status: "sold" }));

    expect(screen.queryByRole("link", { name: "Detayı görüntüle" })).not.toBeInTheDocument();
    expect(screen.getByText("Yayında değil")).toBeInTheDocument();
    expect(screen.getByText("Satıldı")).toBeInTheDocument();
  });

  it("calls onRemove when the remove button is clicked", () => {
    const onRemove = vi.fn();

    renderFavoriteCard(createFavorite(), { onRemove });

    fireEvent.click(screen.getByRole("button", { name: "Favoriden çıkar" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("disables the remove action while a favorite is pending", () => {
    const onRemove = vi.fn();

    renderFavoriteCard(createFavorite(), {
      isPending: true,
      onRemove
    });

    const button = screen.getByRole("button", { name: "Favoriden çıkar" });

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Kaldırılıyor");

    fireEvent.click(button);

    expect(onRemove).not.toHaveBeenCalled();
  });
});

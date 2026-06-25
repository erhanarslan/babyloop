import React, { type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
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
  formatListingStatus: () => "Aktif",
  formatListingType: () => "Satılık"
}));

function createFavorite(overrides: Partial<FavoriteListing> = {}): FavoriteListing {
  return {
    id: "30000000-0000-4000-8000-000000001001",
    title: "Travel sistem bebek arabası",
    price: {
      amount: "1250.00",
      currency: "TRY"
    },
    status: "active",
    listingType: "sale",
    condition: "new",
    category: {
      id: "20000000-0000-4000-8000-000000000001",
      name: "Bebek Arabası",
      slug: "bebek-arabasi"
    },
    firstImage: null,
    images: [],
    favoritedAt: "2026-06-25T12:00:00.000Z",
    ...overrides
  };
}

function renderFavoriteCard(favorite: FavoriteListing) {
  return render(
    React.createElement(FavoriteCard, {
      apiBaseUrl: "http://localhost:4000",
      favorite,
      isPending: false,
      onRemove: vi.fn()
    })
  );
}

describe("FavoriteCard", () => {
  it("renders the listing image when the favorite has an image", () => {
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

  it("renders the category placeholder when the favorite has no image", () => {
    renderFavoriteCard(createFavorite());

    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("Travel sistem bebek arabası")).toBeInTheDocument();
  });
});

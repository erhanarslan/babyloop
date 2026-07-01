import {
  cartItems,
  events,
  listingImages,
  listings,
  orderItems,
  orders,
  productCategories
} from "@babyloop/database/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import type { ListingImageResponse, PriceResponse } from "./listing-response.mapper.js";

export type CartListingSummary = {
  id: string;
  title: string;
  price: PriceResponse;
  status: string;
  listingType: string;
  condition: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  firstImage: ListingImageResponse | null;
  images: ListingImageResponse[];
};

export type CartItemResponse = {
  id: string;
  listing: CartListingSummary;
  createdAt: string;
};

export type CartResponse = {
  items: CartItemResponse[];
  unavailableItems: CartItemResponse[];
  subtotal: {
    amount: string;
    currency: "TRY";
  };
  currency: "TRY";
};

export type MockCheckoutItemResponse = {
  listingId: string;
  title: string;
  price: PriceResponse;
  listingType: string;
};

export type MockCheckoutResponse = {
  orderId: string;
  paymentId: string;
  mockIyzicoPaymentId: string;
  status: "paid";
  paidAmount: string;
  currency: "TRY";
  items: MockCheckoutItemResponse[];
};

type CartRow = {
  cartItemId: string;
  cartCreatedAt: Date;
  listingId: string;
  sellerProfileId: string;
  title: string;
  priceAmount: string | null;
  currency: string;
  status: string;
  listingType: string;
  condition: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
};

export async function getCartForCurrentUser(
  app: FastifyInstance,
  currentUser: CurrentUser
): Promise<CartResponse> {
  const rows = await selectCartRows(app, currentUser.profile.id);
  return buildCartResponse(app, rows);
}

export async function addCartItem(
  app: FastifyInstance,
  currentUser: CurrentUser,
  listingId: string
): Promise<
  | { status: "added" | "already_exists"; cart: CartResponse }
  | { status: "not_found" | "own_listing" | "listing_unavailable" }
> {
  const listing = await selectCartListing(app, listingId);

  if (!listing) {
    return { status: "not_found" };
  }

  if (listing.sellerProfileId === currentUser.profile.id) {
    return { status: "own_listing" };
  }

  if (listing.status !== "active") {
    return { status: "listing_unavailable" };
  }

  const now = new Date();
  const [existing] = await app.db
    .select({ id: cartItems.id })
    .from(cartItems)
    .where(and(eq(cartItems.buyerProfileId, currentUser.profile.id), eq(cartItems.listingId, listingId)))
    .limit(1);

  if (existing) {
    await app.db
      .update(cartItems)
      .set({ updatedAt: now })
      .where(eq(cartItems.id, existing.id));

    return {
      status: "already_exists",
      cart: await getCartForCurrentUser(app, currentUser)
    };
  }

  await app.db.insert(cartItems).values({
    buyerProfileId: currentUser.profile.id,
    listingId,
    createdAt: now,
    updatedAt: now
  });

  return {
    status: "added",
    cart: await getCartForCurrentUser(app, currentUser)
  };
}

export async function removeCartItem(
  app: FastifyInstance,
  currentUser: CurrentUser,
  listingId: string
): Promise<CartResponse> {
  await app.db
    .delete(cartItems)
    .where(and(eq(cartItems.buyerProfileId, currentUser.profile.id), eq(cartItems.listingId, listingId)));

  return getCartForCurrentUser(app, currentUser);
}

export async function clearCart(
  app: FastifyInstance,
  currentUser: CurrentUser
): Promise<CartResponse> {
  await app.db.delete(cartItems).where(eq(cartItems.buyerProfileId, currentUser.profile.id));

  return getCartForCurrentUser(app, currentUser);
}

export async function checkoutCartWithMockIyzico(
  app: FastifyInstance,
  currentUser: CurrentUser,
  scenario: "success" | "failure"
): Promise<
  | { status: "paid"; checkout: MockCheckoutResponse }
  | { status: "payment_failed"; cart: CartResponse }
  | { status: "empty_cart" | "listing_unavailable" | "unsupported_listing_type" }
> {
  const rows = await selectCartRows(app, currentUser.profile.id);

  if (rows.length === 0) {
    return { status: "empty_cart" };
  }

  if (rows.some((row) => row.status !== "active")) {
    return { status: "listing_unavailable" };
  }

  if (rows.some((row) => row.listingType !== "sale")) {
    return { status: "unsupported_listing_type" };
  }

  if (scenario === "failure") {
    return {
      status: "payment_failed",
      cart: await buildCartResponse(app, rows)
    };
  }

  const checkout = await app.db.transaction(async (tx) => {
    const listingIds = rows.map((row) => row.listingId);
    const now = new Date();
    const totalAmount = formatMoney(rows.reduce((sum, row) => sum + parseMoney(row.priceAmount), 0));
    const providerPaymentId = `mock-iyzico-${randomUUID()}`;

    const soldRows = await tx
      .update(listings)
      .set({
        status: "sold",
        updatedAt: now
      })
      .where(and(inArray(listings.id, listingIds), eq(listings.status, "active")))
      .returning({ id: listings.id });

    if (soldRows.length !== listingIds.length) {
      return { status: "listing_unavailable" as const };
    }

    const [order] = await tx
      .insert(orders)
      .values({
        buyerProfileId: currentUser.profile.id,
        status: "paid",
        currency: "TRY",
        totalAmount,
        paymentProvider: "mock_iyzico",
        providerPaymentId,
        createdAt: now,
        updatedAt: now
      })
      .returning({
        id: orders.id,
        providerPaymentId: orders.providerPaymentId
      });

    if (!order || !order.providerPaymentId) {
      throw new Error("Mock checkout order insert failed.");
    }

    await tx.insert(orderItems).values(
      rows.map((row) => ({
        orderId: order.id,
        listingId: row.listingId,
        sellerProfileId: row.sellerProfileId,
        titleSnapshot: row.title,
        priceAmountSnapshot: row.priceAmount ?? "0.00",
        currencySnapshot: row.currency,
        listingTypeSnapshot: row.listingType
      }))
    );

    await tx.delete(cartItems).where(eq(cartItems.buyerProfileId, currentUser.profile.id));

    await tx.insert(events).values(
      rows.map((row) => ({
        actorProfileId: currentUser.profile.id,
        eventType: "mock_checkout_paid",
        entityType: "listing",
        entityId: row.listingId,
        metadata: {
          orderId: order.id,
          paymentProvider: "mock_iyzico",
          providerPaymentId: order.providerPaymentId
        }
      }))
    );

    return {
      status: "paid" as const,
      checkout: {
        orderId: order.id,
        paymentId: order.providerPaymentId,
        mockIyzicoPaymentId: order.providerPaymentId,
        status: "paid" as const,
        paidAmount: totalAmount,
        currency: "TRY" as const,
        items: rows.map((row) => ({
          listingId: row.listingId,
          title: row.title,
          price: buildPrice(row.priceAmount, row.currency),
          listingType: row.listingType
        }))
      }
    };
  });

  return checkout;
}

async function selectCartListing(app: FastifyInstance, listingId: string): Promise<{
  sellerProfileId: string;
  status: string;
} | null> {
  const [row] = await app.db
    .select({
      sellerProfileId: listings.sellerProfileId,
      status: listings.status
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  return row ?? null;
}

async function selectCartRows(app: FastifyInstance, buyerProfileId: string): Promise<CartRow[]> {
  return app.db
    .select({
      cartItemId: cartItems.id,
      cartCreatedAt: cartItems.createdAt,
      listingId: listings.id,
      sellerProfileId: listings.sellerProfileId,
      title: listings.title,
      priceAmount: listings.priceAmount,
      currency: listings.currency,
      status: listings.status,
      listingType: listings.listingType,
      condition: listings.condition,
      categoryId: productCategories.id,
      categoryName: productCategories.name,
      categorySlug: productCategories.slug
    })
    .from(cartItems)
    .innerJoin(listings, eq(listings.id, cartItems.listingId))
    .innerJoin(productCategories, eq(productCategories.id, listings.categoryId))
    .where(eq(cartItems.buyerProfileId, buyerProfileId))
    .orderBy(asc(cartItems.createdAt));
}

async function buildCartResponse(app: FastifyInstance, rows: CartRow[]): Promise<CartResponse> {
  const imagesByListingId = await getCartImagesByListingIds(app, rows.map((row) => row.listingId));
  const items = rows.map((row) => mapCartItem(row, imagesByListingId.get(row.listingId) ?? []));
  const availableItems = items.filter((item) => item.listing.status === "active");

  return {
    items: availableItems,
    unavailableItems: items.filter((item) => item.listing.status !== "active"),
    subtotal: {
      amount: formatMoney(
        availableItems.reduce((sum, item) => (
          item.listing.listingType === "sale" ? sum + parseMoney(item.listing.price?.amount ?? null) : sum
        ), 0)
      ),
      currency: "TRY"
    },
    currency: "TRY"
  };
}

function mapCartItem(row: CartRow, images: ListingImageResponse[]): CartItemResponse {
  return {
    id: row.cartItemId,
    createdAt: row.cartCreatedAt.toISOString(),
    listing: {
      id: row.listingId,
      title: row.title,
      price: buildPrice(row.priceAmount, row.currency),
      status: row.status,
      listingType: row.listingType,
      condition: row.condition,
      category: {
        id: row.categoryId,
        name: row.categoryName,
        slug: row.categorySlug
      },
      firstImage: images[0] ?? null,
      images
    }
  };
}

async function getCartImagesByListingIds(
  app: FastifyInstance,
  listingIds: string[]
): Promise<Map<string, ListingImageResponse[]>> {
  if (listingIds.length === 0) {
    return new Map();
  }

  const rows = await app.db
    .select({
      id: listingImages.id,
      listingId: listingImages.listingId,
      url: listingImages.url,
      sortOrder: listingImages.sortOrder
    })
    .from(listingImages)
    .where(and(inArray(listingImages.listingId, listingIds), eq(listingImages.reviewStatus, "approved")))
    .orderBy(asc(listingImages.listingId), asc(listingImages.sortOrder));

  const imagesByListingId = new Map<string, ListingImageResponse[]>();

  for (const row of rows) {
    const images = imagesByListingId.get(row.listingId) ?? [];

    if (images.length >= 5) {
      continue;
    }

    images.push({
      id: row.id,
      url: row.url,
      sortOrder: row.sortOrder
    });
    imagesByListingId.set(row.listingId, images);
  }

  return imagesByListingId;
}

function buildPrice(amount: string | null, currency: string): PriceResponse {
  if (amount === null) {
    return null;
  }

  return {
    amount,
    currency
  };
}

function parseMoney(value: string | null): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

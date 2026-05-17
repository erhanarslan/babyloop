import {
  productCategories,
  listings
} from "@babyloop/database/schema";
import type { Database } from "@babyloop/database";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

let sequence = 0;

type AuthPayload = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
  profile: {
    id: string;
    displayName: string;
    locationCity: string | null;
  };
};

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export function authHeader(token: string) {
  return {
    authorization: `Bearer ${token}`
  };
}

export async function createUser(
  app: FastifyInstance,
  overrides: Partial<{
    displayName: string;
    email: string;
    locationCity: string;
    password: string;
  }> = {}
): Promise<AuthPayload> {
  const email = overrides.email ?? `user-${nextId()}@babyloop.test`;
  const password = overrides.password ?? "Password123!";
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      displayName: overrides.displayName ?? `User ${sequence}`,
      email,
      locationCity: overrides.locationCity ?? "Istanbul",
      password
    }
  });

  if (response.statusCode !== 201) {
    throw new Error(`User setup failed: ${response.statusCode} ${response.body}`);
  }

  return response.json<ApiSuccess<AuthPayload>>().data;
}

export async function loginUser(
  app: FastifyInstance,
  email: string,
  password = "Password123!"
): Promise<AuthPayload> {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: {
      email,
      password
    }
  });

  if (response.statusCode !== 200) {
    throw new Error(`Login setup failed: ${response.statusCode} ${response.body}`);
  }

  return response.json<ApiSuccess<AuthPayload>>().data;
}

export async function createCategory(
  db: Database,
  overrides: Partial<{
    name: string;
    slug: string;
  }> = {}
) {
  const id = nextId();
  const [category] = await db
    .insert(productCategories)
    .values({
      name: overrides.name ?? `Category ${id}`,
      slug: overrides.slug ?? `category-${id}`
    })
    .returning({
      id: productCategories.id,
      name: productCategories.name,
      slug: productCategories.slug
    });

  if (!category) {
    throw new Error("Category setup failed.");
  }

  return category;
}

export async function createListing(
  app: FastifyInstance,
  token: string,
  overrides: Partial<{
    categoryId: string;
    condition: string;
    listingType: string;
    priceAmount: string;
    title: string;
  }> = {}
) {
  const categoryId = overrides.categoryId ?? (await createCategory(app.db)).id;
  const response = await app.inject({
    headers: authHeader(token),
    method: "POST",
    url: "/api/v1/listings",
    payload: {
      categoryId,
      condition: overrides.condition ?? "good",
      currency: "TRY",
      listingType: overrides.listingType ?? "sale",
      priceAmount: overrides.priceAmount ?? "1000.00",
      title: overrides.title ?? `Listing ${nextId()}`
    }
  });

  if (response.statusCode !== 201) {
    throw new Error(`Listing setup failed: ${response.statusCode} ${response.body}`);
  }

  return response.json<ApiSuccess<{
    listing: {
      id: string;
      title: string;
    };
  }>>().data.listing;
}

export async function getListingSellerProfileId(
  db: Database,
  listingId: string
): Promise<string> {
  const [row] = await db
    .select({
      sellerProfileId: listings.sellerProfileId
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!row) {
    throw new Error("Listing seller lookup failed.");
  }

  return row.sellerProfileId;
}

function nextId(): number {
  sequence += 1;
  return sequence;
}

import { scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { eq, sql } from "drizzle-orm";
import { createDatabaseClient } from "./client.js";
import {
  events,
  favorites,
  listingImages,
  listings,
  productCategories,
  profiles,
  users
} from "./schema/index.js";

const scrypt = promisify(scryptCallback);
const DEV_PASSWORD = "Test123456";
const KEY_LENGTH = 64;
const PASSWORD_HASH_VERSION = "scrypt-v1";

const ids = {
  users: {
    ayse: "70000000-0000-4000-8000-000000000001",
    mehmet: "70000000-0000-4000-8000-000000000002"
  },
  profiles: {
    ayse: "10000000-0000-4000-8000-000000000001",
    mehmet: "10000000-0000-4000-8000-000000000002"
  },
  categories: {
    strollers: "20000000-0000-4000-8000-000000000001",
    carSeats: "20000000-0000-4000-8000-000000000002",
    toys: "20000000-0000-4000-8000-000000000003",
    montessoriToys: "20000000-0000-4000-8000-000000000004"
  },
  listings: {
    stroller: "30000000-0000-4000-8000-000000000001",
    carSeat: "30000000-0000-4000-8000-000000000002",
    toySet: "30000000-0000-4000-8000-000000000003"
  },
  images: {
    strollerCover: "40000000-0000-4000-8000-000000000001",
    strollerFolded: "40000000-0000-4000-8000-000000000002",
    carSeat: "40000000-0000-4000-8000-000000000003",
    toySet: "40000000-0000-4000-8000-000000000004"
  },
  favorite: "50000000-0000-4000-8000-000000000001",
  events: {
    strollerCreated: "60000000-0000-4000-8000-000000000001",
    carSeatCreated: "60000000-0000-4000-8000-000000000002",
    strollerViewed: "60000000-0000-4000-8000-000000000003",
    favoriteAdded: "60000000-0000-4000-8000-000000000004"
  }
} as const;

async function seed() {
  const client = createDatabaseClient();
  const passwordHash = await hashSeedPassword(DEV_PASSWORD);

  try {
    await ensureSeedSchemaCompatibility(client.db);

    await client.db
      .insert(users)
      .values([
        {
          id: ids.users.ayse,
          email: "ayse@example.com",
          passwordHash,
          role: "user"
        },
        {
          id: ids.users.mehmet,
          email: "mehmet@example.com",
          passwordHash,
          role: "user"
        }
      ])
      .onConflictDoUpdate({
        target: users.email,
        set: {
          passwordHash,
          role: "user"
        }
      });

    const devUsers = await getDevUsers(client.db);

    await client.db
      .insert(profiles)
      .values([
        {
          id: ids.profiles.ayse,
          userId: devUsers.ayse,
          displayName: "Ayse Demir",
          avatarUrl: null,
          locationCity: "Istanbul"
        },
        {
          id: ids.profiles.mehmet,
          userId: devUsers.mehmet,
          displayName: "Mehmet Kaya",
          avatarUrl: null,
          locationCity: "Ankara"
        }
      ])
      .onConflictDoNothing();

    await client.db
      .update(profiles)
      .set({
        avatarUrl: null,
        displayName: "Ayse Demir",
        locationCity: "Istanbul",
        userId: devUsers.ayse
      })
      .where(eq(profiles.id, ids.profiles.ayse));

    await client.db
      .update(profiles)
      .set({
        avatarUrl: null,
        displayName: "Mehmet Kaya",
        locationCity: "Ankara",
        userId: devUsers.mehmet
      })
      .where(eq(profiles.id, ids.profiles.mehmet));

    await client.db
      .insert(productCategories)
      .values([
        {
          id: ids.categories.strollers,
          name: "Strollers",
          slug: "strollers",
          parentId: null
        },
        {
          id: ids.categories.carSeats,
          name: "Car Seats",
          slug: "car-seats",
          parentId: null
        },
        {
          id: ids.categories.toys,
          name: "Toys",
          slug: "toys",
          parentId: null
        }
      ])
      .onConflictDoNothing();

    await client.db
      .insert(productCategories)
      .values({
        id: ids.categories.montessoriToys,
        name: "Montessori Toys",
        slug: "montessori-toys",
        parentId: ids.categories.toys
      })
      .onConflictDoNothing();

    await client.db
      .insert(listings)
      .values([
        {
          id: ids.listings.stroller,
          sellerProfileId: ids.profiles.ayse,
          categoryId: ids.categories.strollers,
          title: "Clean foldable stroller with rain cover",
          description: "Used for one child, folds easily, includes rain cover and cup holder.",
          priceAmount: "4500.00",
          status: "active",
          listingType: "sale",
          condition: "good"
        },
        {
          id: ids.listings.carSeat,
          sellerProfileId: ids.profiles.mehmet,
          categoryId: ids.categories.carSeats,
          title: "Rear-facing baby car seat",
          description: "No accident history claimed by seller. Buyer should verify safety details.",
          priceAmount: "3200.00",
          status: "active",
          listingType: "sale",
          condition: "good"
        },
        {
          id: ids.listings.toySet,
          sellerProfileId: ids.profiles.ayse,
          categoryId: ids.categories.montessoriToys,
          title: "Wooden Montessori toy set",
          description: "Includes stacking rings, shape sorter, and sensory blocks.",
          priceAmount: "900.00",
          status: "active",
          listingType: "sale",
          condition: "like_new"
        }
      ])
      .onConflictDoNothing();

    await client.db
      .insert(listingImages)
      .values([
        {
          id: ids.images.strollerCover,
          listingId: ids.listings.stroller,
          url: "https://example.local/seed/stroller-cover.jpg",
          sortOrder: 0
        },
        {
          id: ids.images.strollerFolded,
          listingId: ids.listings.stroller,
          url: "https://example.local/seed/stroller-folded.jpg",
          sortOrder: 1
        },
        {
          id: ids.images.carSeat,
          listingId: ids.listings.carSeat,
          url: "https://example.local/seed/car-seat.jpg",
          sortOrder: 0
        },
        {
          id: ids.images.toySet,
          listingId: ids.listings.toySet,
          url: "https://example.local/seed/montessori-toys.jpg",
          sortOrder: 0
        }
      ])
      .onConflictDoNothing();

    await client.db
      .insert(favorites)
      .values({
        id: ids.favorite,
        profileId: ids.profiles.mehmet,
        listingId: ids.listings.stroller
      })
      .onConflictDoNothing();

    await client.db
      .insert(events)
      .values([
        {
          id: ids.events.strollerCreated,
          actorProfileId: ids.profiles.ayse,
          eventType: "listing_created",
          entityType: "listing",
          entityId: ids.listings.stroller,
          metadata: { source: "seed", category: "strollers" }
        },
        {
          id: ids.events.carSeatCreated,
          actorProfileId: ids.profiles.mehmet,
          eventType: "listing_created",
          entityType: "listing",
          entityId: ids.listings.carSeat,
          metadata: { source: "seed", category: "car-seats" }
        },
        {
          id: ids.events.strollerViewed,
          actorProfileId: ids.profiles.mehmet,
          eventType: "listing_viewed",
          entityType: "listing",
          entityId: ids.listings.stroller,
          metadata: { source: "seed", surface: "home-preview" }
        },
        {
          id: ids.events.favoriteAdded,
          actorProfileId: ids.profiles.mehmet,
          eventType: "favorite_added",
          entityType: "favorite",
          entityId: ids.favorite,
          metadata: { source: "seed", listingId: ids.listings.stroller }
        }
      ])
      .onConflictDoNothing();

    console.log("Seed data inserted or already present.");
  } finally {
    await client.close();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function hashSeedPassword(password: string): Promise<string> {
  const salt = "babyloop-local-dev-seed-v1";
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return `${PASSWORD_HASH_VERSION}:${salt}:${derivedKey.toString("base64url")}`;
}

async function getDevUsers(db: ReturnType<typeof createDatabaseClient>["db"]): Promise<{
  ayse: string;
  mehmet: string;
}> {
  const rows = await db
    .select({
      email: users.email,
      id: users.id
    })
    .from(users)
    .where(eq(users.email, "ayse@example.com"));

  const ayse = rows.find((row) => row.email === "ayse@example.com")?.id;

  const [mehmetRow] = await db
    .select({
      id: users.id
    })
    .from(users)
    .where(eq(users.email, "mehmet@example.com"))
    .limit(1);

  if (!ayse || !mehmetRow) {
    throw new Error("Dev user seed failed.");
  }

  return {
    ayse,
    mehmet: mehmetRow.id
  };
}

async function ensureSeedSchemaCompatibility(
  db: ReturnType<typeof createDatabaseClient>["db"]
): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "mfa_enabled" boolean DEFAULT false NOT NULL
  `);
}
import { scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { eq, inArray, sql } from "drizzle-orm";
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
const DEMO_LISTING_COUNT = 100;

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
    montessoriToys: "20000000-0000-4000-8000-000000000004",
    clothing: "20000000-0000-4000-8000-000000000005",
    feeding: "20000000-0000-4000-8000-000000000006",
    sleep: "20000000-0000-4000-8000-000000000007",
    carriers: "20000000-0000-4000-8000-000000000008",
    bathCare: "20000000-0000-4000-8000-000000000009",
    books: "20000000-0000-4000-8000-000000000010"
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

const seedSellers = [
  {
    email: "ayse@example.com",
    userId: ids.users.ayse,
    profileId: ids.profiles.ayse,
    displayName: "Ayşe Demir",
    locationCity: "İstanbul"
  },
  {
    email: "mehmet@example.com",
    userId: ids.users.mehmet,
    profileId: ids.profiles.mehmet,
    displayName: "Mehmet Kaya",
    locationCity: "Ankara"
  },
  {
    email: "zeynep.seed@example.com",
    userId: "70000000-0000-4000-8000-000000000003",
    profileId: "10000000-0000-4000-8000-000000000003",
    displayName: "Zeynep Yılmaz",
    locationCity: "İstanbul"
  },
  {
    email: "emre.seed@example.com",
    userId: "70000000-0000-4000-8000-000000000004",
    profileId: "10000000-0000-4000-8000-000000000004",
    displayName: "Emre Arslan",
    locationCity: "İzmir"
  },
  {
    email: "elif.seed@example.com",
    userId: "70000000-0000-4000-8000-000000000005",
    profileId: "10000000-0000-4000-8000-000000000005",
    displayName: "Elif Şahin",
    locationCity: "Bursa"
  },
  {
    email: "burak.seed@example.com",
    userId: "70000000-0000-4000-8000-000000000006",
    profileId: "10000000-0000-4000-8000-000000000006",
    displayName: "Burak Koç",
    locationCity: "Antalya"
  },
  {
    email: "selin.seed@example.com",
    userId: "70000000-0000-4000-8000-000000000007",
    profileId: "10000000-0000-4000-8000-000000000007",
    displayName: "Selin Aydın",
    locationCity: "Kocaeli"
  },
  {
    email: "mert.seed@example.com",
    userId: "70000000-0000-4000-8000-000000000008",
    profileId: "10000000-0000-4000-8000-000000000008",
    displayName: "Mert Özkan",
    locationCity: "Eskişehir"
  }
] as const;

const seedCategories = [
  {
    id: ids.categories.strollers,
    name: "Bebek Arabaları",
    slug: "strollers",
    parentId: null
  },
  {
    id: ids.categories.carSeats,
    name: "Oto Koltukları",
    slug: "car-seats",
    parentId: null
  },
  {
    id: ids.categories.toys,
    name: "Oyuncaklar",
    slug: "toys",
    parentId: null
  },
  {
    id: ids.categories.montessoriToys,
    name: "Montessori Oyuncakları",
    slug: "montessori-toys",
    parentId: ids.categories.toys
  },
  {
    id: ids.categories.clothing,
    name: "Bebek Giyim",
    slug: "baby-clothing",
    parentId: null
  },
  {
    id: ids.categories.feeding,
    name: "Beslenme",
    slug: "feeding",
    parentId: null
  },
  {
    id: ids.categories.sleep,
    name: "Uyku ve Oda",
    slug: "sleep-room",
    parentId: null
  },
  {
    id: ids.categories.carriers,
    name: "Kanguru ve Taşıma",
    slug: "carriers",
    parentId: null
  },
  {
    id: ids.categories.bathCare,
    name: "Banyo ve Bakım",
    slug: "bath-care",
    parentId: null
  },
  {
    id: ids.categories.books,
    name: "Kitap ve Eğitici Setler",
    slug: "books-education",
    parentId: null
  }
] as const;

const demoProductTemplates = [
  {
    title: "Travel sistem bebek arabası",
    categorySlug: "strollers",
    minPrice: 5800,
    maxPrice: 14800,
    imageUrl: "http://localhost:3000/brand/home/home-hero-travel.png"
  },
  {
    title: "Katlanabilir baston bebek arabası",
    categorySlug: "strollers",
    minPrice: 2400,
    maxPrice: 7200,
    imageUrl: "http://localhost:3000/brand/home/home-hero-travel.png"
  },
  {
    title: "Isofix oto koltuğu 9-18 kg",
    categorySlug: "car-seats",
    minPrice: 2800,
    maxPrice: 9800,
    imageUrl: "http://localhost:3000/brand/home/home-hero-travel.png"
  },
  {
    title: "Ana kucağı ve puset uyumlu oto koltuğu",
    categorySlug: "car-seats",
    minPrice: 1900,
    maxPrice: 6500,
    imageUrl: "http://localhost:3000/brand/home/home-hero-travel.png"
  },
  {
    title: "Ahşap Montessori oyuncak seti",
    categorySlug: "montessori-toys",
    minPrice: 450,
    maxPrice: 2100,
    imageUrl: "http://localhost:3000/brand/home/home-hero-play.png"
  },
  {
    title: "Aktivite masası ve eğitici oyuncaklar",
    categorySlug: "toys",
    minPrice: 650,
    maxPrice: 3200,
    imageUrl: "http://localhost:3000/brand/home/home-hero-play.png"
  },
  {
    title: "Mama sandalyesi temiz durumda",
    categorySlug: "feeding",
    minPrice: 900,
    maxPrice: 4200,
    imageUrl: "http://localhost:3000/brand/home/home-hero-feeding.png"
  },
  {
    title: "Biberon sterilizatörü ve beslenme seti",
    categorySlug: "feeding",
    minPrice: 500,
    maxPrice: 2800,
    imageUrl: "http://localhost:3000/brand/home/home-hero-feeding.png"
  },
  {
    title: "Anne yanı beşik",
    categorySlug: "sleep-room",
    minPrice: 1600,
    maxPrice: 7600,
    imageUrl: "http://localhost:3000/brand/home/home-hero-sleep.png"
  },
  {
    title: "Bebek telsizi ve uyku yardımcısı",
    categorySlug: "sleep-room",
    minPrice: 700,
    maxPrice: 3600,
    imageUrl: "http://localhost:3000/brand/home/home-hero-sleep.png"
  },
  {
    title: "Ergonomik kanguru",
    categorySlug: "carriers",
    minPrice: 850,
    maxPrice: 3900,
    imageUrl: "http://localhost:3000/brand/home/home-hero-travel.png"
  },
  {
    title: "0-12 ay bebek giyim paketi",
    categorySlug: "baby-clothing",
    minPrice: 350,
    maxPrice: 1800,
    imageUrl: "http://localhost:3000/brand/home/home-hero-sleep.png"
  },
  {
    title: "Bebek küveti ve bakım seti",
    categorySlug: "bath-care",
    minPrice: 300,
    maxPrice: 1700,
    imageUrl: "http://localhost:3000/brand/home/home-hero-feeding.png"
  },
  {
    title: "İlk kitaplar ve eğitici kart seti",
    categorySlug: "books-education",
    minPrice: 180,
    maxPrice: 950,
    imageUrl: "http://localhost:3000/brand/home/home-hero-play.png"
  }
] as const;

const listingConditions = ["new", "like_new", "good", "fair"] as const;
const listingTypes = ["sale", "sale", "sale", "swap", "donation"] as const;

async function seed() {
  const client = createDatabaseClient();
  const passwordHash = await hashSeedPassword(DEV_PASSWORD);

  try {
    await ensureSeedSchemaCompatibility(client.db);
    await seedUsersAndProfiles(client.db, passwordHash);
    await seedProductCategories(client.db);
    await archiveLocalTestListings(client.db);

    const categoryIdBySlug = await loadCategoryIdBySlug(
      client.db,
      seedCategories.map((category) => category.slug)
    );

    await seedBaseListings(client.db);
    await seedDemoListings(client.db, categoryIdBySlug);

    await seedBaseImagesAndEvents(client.db);

    const [activeCount] = await client.db
      .select({
        total: sql<number>`count(${listings.id})::int`
      })
      .from(listings)
      .where(eq(listings.status, "active"));

    console.log(`Seed data inserted or updated. Active listings: ${activeCount?.total ?? 0}`);
  } finally {
    await client.close();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function archiveLocalTestListings(db: ReturnType<typeof createDatabaseClient>["db"]): Promise<void> {
  if (process.env.BABYLOOP_SEED_KEEP_E2E_LISTINGS === "1") {
    return;
  }

  await db
    .update(listings)
    .set({
      status: "archived",
      updatedAt: new Date()
    })
    .where(sql`
      ${listings.status} in ('active', 'reserved')
      and (
        ${listings.title} ilike '%e2e%'
        or ${listings.title} ilike '%playwright%'
        or ${listings.title} ilike '%smoke%'
        or ${listings.title} ilike '%test listing%'
        or ${listings.title} ilike '%web e2e%'
        or ${listings.title} ilike '%mobile e2e%'
        or ${listings.description} ilike '%e2e%'
        or ${listings.description} ilike '%playwright%'
        or ${listings.description} ilike '%smoke%'
      )
    `);
}

async function seedUsersAndProfiles(
  db: ReturnType<typeof createDatabaseClient>["db"],
  passwordHash: string
): Promise<void> {
  const now = new Date();

  await db
    .insert(users)
    .values(
      seedSellers.map((seller) => ({
        id: seller.userId,
        email: seller.email,
        emailVerifiedAt: now,
        passwordHash,
        role: "user",
        updatedAt: now
      }))
    )
    .onConflictDoUpdate({
      target: users.email,
      set: {
        emailVerifiedAt: now,
        passwordHash,
        role: "user",
        updatedAt: now
      }
    });

  const userRows = await db
    .select({
      email: users.email,
      id: users.id
    })
    .from(users)
    .where(inArray(users.email, seedSellers.map((seller) => seller.email)));

  const userIdByEmail = new Map(userRows.map((user) => [user.email, user.id]));

  const profileValues = seedSellers.map((seller) => ({
    id: seller.profileId,
    userId: userIdByEmail.get(seller.email) ?? seller.userId,
    displayName: seller.displayName,
    avatarUrl: null,
    locationCity: seller.locationCity,
    updatedAt: now
  }));

  await db.insert(profiles).values(profileValues).onConflictDoNothing();

  for (const profile of profileValues) {
    await db
      .update(profiles)
      .set({
        avatarUrl: null,
        displayName: profile.displayName,
        locationCity: profile.locationCity,
        userId: profile.userId,
        updatedAt: now
      })
      .where(eq(profiles.id, profile.id));
  }
}

async function seedProductCategories(
  db: ReturnType<typeof createDatabaseClient>["db"]
): Promise<void> {
  await db
    .insert(productCategories)
    .values(seedCategories.map((category) => ({ ...category })))
    .onConflictDoNothing();

  for (const category of seedCategories) {
    await db
      .update(productCategories)
      .set({
        name: category.name,
        parentId: category.parentId
      })
      .where(eq(productCategories.id, category.id));
  }
}

async function loadCategoryIdBySlug(
  db: ReturnType<typeof createDatabaseClient>["db"],
  slugs: string[]
): Promise<Map<string, string>> {
  const rows = await db
    .select({
      id: productCategories.id,
      slug: productCategories.slug
    })
    .from(productCategories)
    .where(inArray(productCategories.slug, slugs));

  return new Map(rows.map((row) => [row.slug, row.id]));
}

async function seedBaseListings(db: ReturnType<typeof createDatabaseClient>["db"]): Promise<void> {
  const now = new Date();

  const baseListings = [
    {
      id: ids.listings.stroller,
      sellerProfileId: ids.profiles.ayse,
      categoryId: ids.categories.strollers,
      title: "Clean foldable stroller with rain cover",
      description: "Used for one child, folds easily, includes rain cover and cup holder.",
      priceAmount: "4500.00",
      currency: "TRY",
      status: "active" as const,
      listingType: "sale" as const,
      condition: "good" as const,
      createdAt: new Date(now.getTime() - 101 * 60_000),
      updatedAt: now
    },
    {
      id: ids.listings.carSeat,
      sellerProfileId: ids.profiles.mehmet,
      categoryId: ids.categories.carSeats,
      title: "Rear-facing baby car seat",
      description: "No accident history claimed by seller. Buyer should verify safety details.",
      priceAmount: "3200.00",
      currency: "TRY",
      status: "active" as const,
      listingType: "sale" as const,
      condition: "good" as const,
      createdAt: new Date(now.getTime() - 102 * 60_000),
      updatedAt: now
    },
    {
      id: ids.listings.toySet,
      sellerProfileId: ids.profiles.ayse,
      categoryId: ids.categories.montessoriToys,
      title: "Wooden Montessori toy set",
      description: "Includes stacking rings, shape sorter, and sensory blocks.",
      priceAmount: "900.00",
      currency: "TRY",
      status: "active" as const,
      listingType: "sale" as const,
      condition: "like_new" as const,
      createdAt: new Date(now.getTime() - 103 * 60_000),
      updatedAt: now
    }
  ];

  await db.insert(listings).values(baseListings).onConflictDoNothing();

  for (const listing of baseListings) {
    await db
      .update(listings)
      .set({
        sellerProfileId: listing.sellerProfileId,
        categoryId: listing.categoryId,
        title: listing.title,
        description: listing.description,
        priceAmount: listing.priceAmount,
        currency: listing.currency,
        status: listing.status,
        listingType: listing.listingType,
        condition: listing.condition,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt
      })
      .where(eq(listings.id, listing.id));
  }
}

async function seedDemoListings(
  db: ReturnType<typeof createDatabaseClient>["db"],
  categoryIdBySlug: Map<string, string>
): Promise<void> {
  const now = new Date();
  const demoListings: Array<typeof listings.$inferInsert> = [];
  const demoImages: Array<typeof listingImages.$inferInsert> = [];

  for (let index = 0; index < DEMO_LISTING_COUNT; index += 1) {
    const template = demoProductTemplates[index % demoProductTemplates.length];
    const seller = seedSellers[index % seedSellers.length];
    const condition = listingConditions[index % listingConditions.length];
    const listingType = listingTypes[index % listingTypes.length];

    if (!template || !seller || !condition || !listingType) {
      throw new Error("Demo seed template selection failed.");
    }
    const categoryId = categoryIdBySlug.get(template.categorySlug);

    if (!categoryId) {
      throw new Error(`Seed category is missing: ${template.categorySlug}`);
    }

    const listingNumber = index + 1;
    const createdAt = new Date(now.getTime() - index * 60_000);
    const priceAmount =
      listingType === "donation"
        ? null
        : `${computePrice(template.minPrice, template.maxPrice, index)}.00`;

    const listingId = fixedUuid("30000000", 1000 + listingNumber);
    const imageId = fixedUuid("40000000", 1000 + listingNumber);

    demoListings.push({
      id: listingId,
      sellerProfileId: seller.profileId,
      categoryId,
      title: `${template.title} #${listingNumber}`,
      description:
        "Demo ilan verisidir. Ürün temiz, kullanılabilir ve aileden aileye ikinci şans marketplace akışını test etmek için eklenmiştir.",
      priceAmount,
      currency: "TRY",
      status: "active",
      listingType,
      condition,
      createdAt,
      updatedAt: createdAt
    });

    demoImages.push({
      id: imageId,
      listingId,
      url: template.imageUrl,
      sortOrder: 0,
      reviewStatus: "approved",
      reviewedAt: createdAt,
      reviewedByProfileId: null,
      createdAt
    });
  }

  await db.insert(listings).values(demoListings).onConflictDoNothing();

  for (const listing of demoListings) {
    if (!listing.id) {
      throw new Error("Demo listing id is required.");
    }

    await db
      .update(listings)
      .set({
        sellerProfileId: listing.sellerProfileId,
        categoryId: listing.categoryId,
        title: listing.title,
        description: listing.description,
        priceAmount: listing.priceAmount,
        currency: listing.currency,
        status: listing.status,
        listingType: listing.listingType,
        condition: listing.condition,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt
      })
      .where(eq(listings.id, listing.id));
  }

  await db.insert(listingImages).values(demoImages).onConflictDoNothing();

  for (const image of demoImages) {
    if (!image.id) {
      throw new Error("Demo image id is required.");
    }

    await db
      .update(listingImages)
      .set({
        listingId: image.listingId,
        url: image.url,
        sortOrder: image.sortOrder,
        reviewStatus: image.reviewStatus,
        reviewedAt: image.reviewedAt,
        reviewedByProfileId: image.reviewedByProfileId,
        createdAt: image.createdAt
      })
      .where(eq(listingImages.id, image.id));
  }
}

async function seedBaseImagesAndEvents(
  db: ReturnType<typeof createDatabaseClient>["db"]
): Promise<void> {
  await db
    .insert(listingImages)
    .values([
      {
        id: ids.images.strollerCover,
        listingId: ids.listings.stroller,
        url: "http://localhost:3000/brand/home/home-hero-travel.png",
        sortOrder: 0,
        reviewStatus: "approved"
      },
      {
        id: ids.images.strollerFolded,
        listingId: ids.listings.stroller,
        url: "http://localhost:3000/brand/home/home-hero-travel.png",
        sortOrder: 1,
        reviewStatus: "approved"
      },
      {
        id: ids.images.carSeat,
        listingId: ids.listings.carSeat,
        url: "http://localhost:3000/brand/home/home-hero-travel.png",
        sortOrder: 0,
        reviewStatus: "approved"
      },
      {
        id: ids.images.toySet,
        listingId: ids.listings.toySet,
        url: "http://localhost:3000/brand/home/home-hero-play.png",
        sortOrder: 0,
        reviewStatus: "approved"
      }
    ])
    .onConflictDoNothing();

  await db
    .insert(favorites)
    .values({
      id: ids.favorite,
      profileId: ids.profiles.mehmet,
      listingId: ids.listings.stroller
    })
    .onConflictDoNothing();

  await db
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
}

async function hashSeedPassword(password: string): Promise<string> {
  const salt = "babyloop-local-dev-seed-v1";
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return `${PASSWORD_HASH_VERSION}:${salt}:${derivedKey.toString("base64url")}`;
}

async function ensureSeedSchemaCompatibility(
  db: ReturnType<typeof createDatabaseClient>["db"]
): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "mfa_enabled" boolean DEFAULT false NOT NULL
  `);
}

function fixedUuid(prefix: string, value: number): string {
  return `${prefix}-0000-4000-8000-${String(value).padStart(12, "0")}`;
}

function computePrice(minPrice: number, maxPrice: number, index: number): number {
  const range = maxPrice - minPrice;
  const stepped = minPrice + ((index * 733) % Math.max(range, 1));

  return Math.round(stepped / 50) * 50;
}

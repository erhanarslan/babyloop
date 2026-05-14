import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const listingStatusEnum = pgEnum("listing_status", [
  "draft",
  "active",
  "archived"
]);

export const listingTypeEnum = pgEnum("listing_type", [
  "sale",
  "swap",
  "donation",
  "rent"
]);

export const listingConditionEnum = pgEnum("listing_condition", [
  "new",
  "like_new",
  "good",
  "fair",
  "needs_repair"
]);

export const aiModelRunStatusEnum = pgEnum("ai_model_run_status", [
  "success",
  "error",
  "validation_failed",
  "provider_failed",
  "skipped"
]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  avatarUrl: text("avatar_url"),
  locationCity: varchar("location_city", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => productCategories.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("product_categories_slug_unique").on(table.slug),
    index("product_categories_parent_id_idx").on(table.parentId)
  ]
);

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sellerProfileId: uuid("seller_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => productCategories.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description"),
    priceAmount: numeric("price_amount", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 3 }).notNull().default("TRY"),
    status: listingStatusEnum("status").notNull().default("draft"),
    listingType: listingTypeEnum("listing_type").notNull().default("sale"),
    condition: listingConditionEnum("condition").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("listings_seller_profile_id_idx").on(table.sellerProfileId),
    index("listings_category_id_idx").on(table.categoryId),
    index("listings_status_idx").on(table.status)
  ]
);

export const listingImages = pgTable(
  "listing_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("listing_images_listing_id_idx").on(table.listingId)
  ]
);

export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("favorites_profile_listing_unique").on(table.profileId, table.listingId),
    index("favorites_listing_id_idx").on(table.listingId)
  ]
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorProfileId: uuid("actor_profile_id").references(() => profiles.id, {
      onDelete: "set null"
    }),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 120 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("events_actor_profile_id_idx").on(table.actorProfileId),
    index("events_entity_idx").on(table.entityType, table.entityId),
    index("events_event_type_idx").on(table.eventType)
  ]
);

export const aiModelRuns = pgTable(
  "ai_model_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    feature: varchar("feature", { length: 120 }).notNull(),
    providerName: varchar("provider_name", { length: 120 }).notNull(),
    modelName: varchar("model_name", { length: 160 }),
    promptVersion: varchar("prompt_version", { length: 160 }).notNull(),
    input: jsonb("input")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    output: jsonb("output").$type<Record<string, unknown>>(),
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 4 }),
    riskScore: numeric("risk_score", { precision: 5, scale: 4 }),
    status: aiModelRunStatusEnum("status").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("ai_model_runs_feature_idx").on(table.feature),
    index("ai_model_runs_status_idx").on(table.status),
    index("ai_model_runs_created_at_idx").on(table.createdAt)
  ]
);

export const schema = {
  aiModelRuns,
  events,
  favorites,
  listingImages,
  listings,
  productCategories,
  profiles
};

export type DatabaseSchema = typeof schema;

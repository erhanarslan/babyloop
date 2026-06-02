import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
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

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 40 }).notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email)
  ]
);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    avatarUrl: text("avatar_url"),
    locationCity: varchar("location_city", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("profiles_user_id_unique").on(table.userId)
  ]
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 40 }).notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("auth_accounts_provider_account_unique").on(
      table.provider,
      table.providerAccountId
    ),
    index("auth_accounts_user_id_idx").on(table.userId),
    index("auth_accounts_email_idx").on(table.email),
    check("auth_accounts_provider_check", sql`${table.provider} in ('password', 'google')`)
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("sessions_refresh_token_hash_unique").on(table.refreshTokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
    index("sessions_revoked_at_idx").on(table.revokedAt)
  ]
);

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("email_verification_tokens_token_hash_unique").on(table.tokenHash),
    index("email_verification_tokens_user_id_idx").on(table.userId),
    index("email_verification_tokens_expires_at_idx").on(table.expiresAt)
  ]
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("password_reset_tokens_token_hash_unique").on(table.tokenHash),
    index("password_reset_tokens_user_id_idx").on(table.userId),
    index("password_reset_tokens_expires_at_idx").on(table.expiresAt)
  ]
);

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

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileLowId: uuid("profile_low_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    profileHighId: uuid("profile_high_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    createdByProfileId: uuid("created_by_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("conversations_profile_pair_unique").on(table.profileLowId, table.profileHighId),
    index("conversations_profile_low_id_idx").on(table.profileLowId),
    index("conversations_profile_high_id_idx").on(table.profileHighId),
    index("conversations_created_by_profile_id_idx").on(table.createdByProfileId),
    index("conversations_last_message_at_idx").on(table.lastMessageAt),
    check("conversations_profiles_not_same_check", sql`${table.profileLowId} <> ${table.profileHighId}`)
  ]
);

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("conversation_participants_conversation_profile_unique").on(
      table.conversationId,
      table.profileId
    ),
    index("conversation_participants_conversation_id_idx").on(table.conversationId),
    index("conversation_participants_profile_id_idx").on(table.profileId)
  ]
);

export const conversationListingContexts = pgTable(
  "conversation_listing_contexts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    addedByProfileId: uuid("added_by_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("conversation_listing_contexts_conversation_listing_unique").on(
      table.conversationId,
      table.listingId
    ),
    index("conversation_listing_contexts_conversation_id_idx").on(table.conversationId),
    index("conversation_listing_contexts_listing_id_idx").on(table.listingId),
    index("conversation_listing_contexts_added_by_profile_id_idx").on(table.addedByProfileId)
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderProfileId: uuid("sender_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversationId),
    index("messages_conversation_created_at_idx").on(table.conversationId, table.createdAt),
    index("messages_sender_profile_id_idx").on(table.senderProfileId),
    check("messages_body_not_blank_check", sql`length(trim(${table.body})) > 0`),
    check("messages_body_max_length_check", sql`char_length(${table.body}) <= 5000`)
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
  authAccounts,
  conversationListingContexts,
  conversationParticipants,
  conversations,
  emailVerificationTokens,
  events,
  favorites,
  listingImages,
  listings,
  messages,
  passwordResetTokens,
  productCategories,
  profiles,
  sessions,
  users
};

export type DatabaseSchema = typeof schema;

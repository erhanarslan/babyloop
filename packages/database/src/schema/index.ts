import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
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
  "reserved",
  "sold",
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

export const listingImageReviewStatusEnum = pgEnum("listing_image_review_status", [
  "approved",
  "rejected"
]);

export const profileSafetyStatusEnum = pgEnum("profile_safety_status", [
  "active",
  "restricted",
  "suspended"
]);

export const profileTrustRiskLevelEnum = pgEnum("profile_trust_risk_level", [
  "low",
  "medium",
  "high",
  "critical"
]);

export const childAgeBandEnum = pgEnum("child_age_band", [
  "expecting",
  "newborn_0_3",
  "infant_3_6",
  "infant_6_12",
  "toddler_12_24",
  "preschool_24_36",
  "child_3_plus"
]);

export const childProfileGenderEnum = pgEnum("child_profile_gender", [
  "female",
  "male",
  "prefer_not_to_say"
]);

export const childProfileNotificationCadenceEnum = pgEnum("child_profile_notification_cadence", [
  "off",
  "monthly",
  "yearly"
]);

export const aiModelRunStatusEnum = pgEnum("ai_model_run_status", [
  "success",
  "error",
  "validation_failed",
  "provider_failed",
  "skipped"
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "message_received",
  "listing_favorited",
  "listing_status_changed",
  "system"
]);

export const safetyTargetTypeEnum = pgEnum("safety_target_type", [
  "listing",
  "profile",
  "message"
]);

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "reviewed",
  "dismissed",
  "action_taken"
]);

export const moderationCaseStatusEnum = pgEnum("moderation_case_status", [
  "pending",
  "in_review",
  "resolved",
  "dismissed"
]);

export const moderationPriorityEnum = pgEnum("moderation_priority", [
  "low",
  "normal",
  "high"
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
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
    safetyStatus: profileSafetyStatusEnum("safety_status").notNull().default("active"),
    safetyStatusUpdatedAt: timestamp("safety_status_updated_at", { withTimezone: true }),
    safetyStatusReasonCode: varchar("safety_status_reason_code", { length: 80 }),
    safetyStatusUpdatedByProfileId: uuid("safety_status_updated_by_profile_id").references(
      (): AnyPgColumn => profiles.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("profiles_user_id_unique").on(table.userId),
    index("profiles_safety_status_idx").on(table.safetyStatus),
    index("profiles_safety_status_updated_by_idx").on(table.safetyStatusUpdatedByProfileId)
  ]
);

export const profileTrustSnapshots = pgTable(
  "profile_trust_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    trustScore: integer("trust_score").notNull().default(100),
    riskScore: integer("risk_score").notNull().default(0),
    riskLevel: profileTrustRiskLevelEnum("risk_level").notNull().default("low"),
    safetyStatus: profileSafetyStatusEnum("safety_status").notNull().default("active"),
    openCaseCount: integer("open_case_count").notNull().default(0),
    totalCaseCount: integer("total_case_count").notNull().default(0),
    recentReportCount: integer("recent_report_count").notNull().default(0),
    recentEnforcementCount: integer("recent_enforcement_count").notNull().default(0),
    sensitiveAccessCount: integer("sensitive_access_count").notNull().default(0),
    aiSummaryCount: integer("ai_summary_count").notNull().default(0),
    lastReportAt: timestamp("last_report_at", { withTimezone: true }),
    lastEnforcementAt: timestamp("last_enforcement_at", { withTimezone: true }),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("profile_trust_snapshots_profile_id_unique").on(table.profileId),
    index("profile_trust_snapshots_risk_level_idx").on(table.riskLevel),
    index("profile_trust_snapshots_computed_at_idx").on(table.computedAt),
    check("profile_trust_snapshots_trust_score_check", sql`${table.trustScore} between 0 and 100`),
    check("profile_trust_snapshots_risk_score_check", sql`${table.riskScore} between 0 and 100`)
  ]
);

export const childProfiles = pgTable(
  "child_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 80 }).notNull().default("Çocuğum"),
    ageBand: childAgeBandEnum("age_band").notNull(),
    ageMonths: integer("age_months"),
    birthMonth: integer("birth_month"),
    birthYear: integer("birth_year"),
    gender: childProfileGenderEnum("gender"),
    notificationCadence: childProfileNotificationCadenceEnum("notification_cadence").notNull().default("off"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("child_profiles_profile_id_idx").on(table.profileId),
    index("child_profiles_age_band_idx").on(table.ageBand),
    index("child_profiles_profile_active_idx").on(table.profileId, table.isActive),
    check("child_profiles_label_not_blank_check", sql`length(trim(${table.label})) > 0`),
    check("child_profiles_age_months_check", sql`${table.ageMonths} is null or ${table.ageMonths} between 0 and 96`),
    check("child_profiles_birth_month_check", sql`${table.birthMonth} is null or ${table.birthMonth} between 1 and 12`),
    check("child_profiles_birth_year_check", sql`${table.birthYear} is null or ${table.birthYear} between 2016 and 2035`)
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

export const mfaOtpChallenges = pgTable(
  "mfa_otp_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    purpose: varchar("purpose", { length: 40 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("mfa_otp_challenges_code_hash_idx").on(table.codeHash),
    index("mfa_otp_challenges_user_id_idx").on(table.userId),
    index("mfa_otp_challenges_expires_at_idx").on(table.expiresAt)
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
    reviewStatus: listingImageReviewStatusEnum("review_status").notNull().default("approved"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByProfileId: uuid("reviewed_by_profile_id").references(() => profiles.id, {
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("listing_images_listing_id_idx").on(table.listingId),
    index("listing_images_review_status_idx").on(table.reviewStatus)
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

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    queryText: varchar("query_text", { length: 120 }),
    categoryId: uuid("category_id").references(() => productCategories.id, { onDelete: "set null" }),
    listingType: listingTypeEnum("listing_type"),
    condition: listingConditionEnum("condition"),
    priceMin: numeric("price_min", { precision: 12, scale: 2 }),
    priceMax: numeric("price_max", { precision: 12, scale: 2 }),
    hasImages: boolean("has_images").notNull().default(false),
    sort: varchar("sort", { length: 32 }).notNull().default("newest"),
    notificationsEnabled: boolean("notifications_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("saved_searches_profile_id_idx").on(table.profileId),
    index("saved_searches_category_id_idx").on(table.categoryId),
    index("saved_searches_created_at_idx").on(table.createdAt),
    check("saved_searches_name_not_blank_check", sql`length(trim(${table.name})) > 0`),
    check("saved_searches_query_text_not_blank_check", sql`${table.queryText} is null or length(trim(${table.queryText})) > 0`)
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
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("conversation_participants_conversation_profile_unique").on(
      table.conversationId,
      table.profileId
    ),
    index("conversation_participants_conversation_id_idx").on(table.conversationId),
    index("conversation_participants_profile_id_idx").on(table.profileId),
    index("conversation_participants_profile_read_idx").on(table.profileId, table.lastReadAt)
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

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientProfileId: uuid("recipient_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    actorProfileId: uuid("actor_profile_id").references(() => profiles.id, {
      onDelete: "set null"
    }),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body").notNull(),
    entityType: varchar("entity_type", { length: 80 }),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("notifications_recipient_created_at_idx").on(
      table.recipientProfileId,
      table.createdAt
    ),
    index("notifications_recipient_read_at_idx").on(table.recipientProfileId, table.readAt),
    index("notifications_entity_idx").on(table.entityType, table.entityId)
  ]
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterProfileId: uuid("reporter_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    targetType: safetyTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: varchar("reason", { length: 80 }).notNull(),
    details: text("details"),
    status: reportStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("reports_reporter_target_unique").on(
      table.reporterProfileId,
      table.targetType,
      table.targetId
    ),
    index("reports_target_idx").on(table.targetType, table.targetId),
    index("reports_status_created_at_idx").on(table.status, table.createdAt),
    index("reports_reporter_profile_id_idx").on(table.reporterProfileId),
    check(
      "reports_reason_check",
      sql`${table.reason} in ('safety', 'scam', 'inappropriate', 'prohibited_item', 'harassment', 'other')`
    )
  ]
);

export const blockedProfiles = pgTable(
  "blocked_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerProfileId: uuid("blocker_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    blockedProfileId: uuid("blocked_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("blocked_profiles_blocker_blocked_unique").on(
      table.blockerProfileId,
      table.blockedProfileId
    ),
    index("blocked_profiles_blocker_profile_id_idx").on(table.blockerProfileId),
    index("blocked_profiles_blocked_profile_id_idx").on(table.blockedProfileId),
    check(
      "blocked_profiles_not_self_check",
      sql`${table.blockerProfileId} <> ${table.blockedProfileId}`
    )
  ]
);

export const moderationCases = pgTable(
  "moderation_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id").references(() => reports.id, { onDelete: "set null" }),
    targetType: safetyTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    status: moderationCaseStatusEnum("status").notNull().default("pending"),
    priority: moderationPriorityEnum("priority").notNull().default("normal"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("moderation_cases_report_id_idx").on(table.reportId),
    index("moderation_cases_target_idx").on(table.targetType, table.targetId),
    index("moderation_cases_status_priority_idx").on(table.status, table.priority)
  ]
);

export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moderationCaseId: uuid("moderation_case_id").references(() => moderationCases.id, {
      onDelete: "set null"
    }),
    actorProfileId: uuid("actor_profile_id").references(() => profiles.id, {
      onDelete: "set null"
    }),
    actionType: varchar("action_type", { length: 80 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("moderation_actions_case_id_idx").on(table.moderationCaseId),
    index("moderation_actions_actor_profile_id_idx").on(table.actorProfileId),
    index("moderation_actions_action_type_idx").on(table.actionType)
  ]
);

export const userSafetyEvents = pgTable(
  "user_safety_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("user_safety_events_profile_id_idx").on(table.profileId),
    index("user_safety_events_event_type_idx").on(table.eventType),
    index("user_safety_events_created_at_idx").on(table.createdAt)
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
  blockedProfiles,
  conversationListingContexts,
  conversationParticipants,
  conversations,
  emailVerificationTokens,
  events,
  favorites,
  listingImages,
  listings,
  messages,
  mfaOtpChallenges,
  moderationActions,
  moderationCases,
  notifications,
  passwordResetTokens,
  productCategories,
  profiles,
  profileTrustSnapshots,
  reports,
  sessions,
  userSafetyEvents,
  users
};

export type DatabaseSchema = typeof schema;

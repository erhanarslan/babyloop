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

export const listingPublicationStateEnum = pgEnum("listing_publication_state", [
  "awaiting_images",
  "ai_review",
  "admin_review",
  "scheduled",
  "published",
  "changes_requested"
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
  "pending",
  "approved",
  "needs_review",
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
  "weekly",
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

export const loginApprovalChallengeStatusEnum = pgEnum("login_approval_challenge_status", [
  "pending",
  "approved",
  "denied",
  "expired",
  "consumed"
]);

export const childProfileNoteTypeEnum = pgEnum("child_profile_note_type", [
  "general",
  "feeding",
  "diaper",
  "sleep",
  "activity",
  "shopping",
  "health_note",
  "size",
  "preference",
  "daycare",
  "milestone"
]);

export const childProfileReminderChannelEnum = pgEnum("child_profile_reminder_channel", [
  "in_app",
  "email_draft"
]);

export const childProfileReminderStatusEnum = pgEnum("child_profile_reminder_status", [
  "scheduled",
  "paused",
  "completed",
  "cancelled"
]);

export const notificationPreferenceSourceEnum = pgEnum("notification_preference_source", [
  "child_reminder",
  "child_note",
  "saved_search",
  "child_lifecycle",
  "marketplace",
  "messages",
  "message",
  "listing",
  "security",
  "marketing",
  "trust_safety"
]);

export const notificationPreferenceChannelEnum = pgEnum("notification_preference_channel", [
  "in_app",
  "email",
  "push",
  "n8n",
  "sms"
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
    mobileLoginApprovalEnabled: boolean("mobile_login_approval_enabled").notNull().default(false),
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
    index("profiles_location_city_normalized_idx")
      .on(sql`lower(trim(${table.locationCity}))`)
      .where(sql`${table.locationCity} is not null`),
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
    ageAsOfDate: timestamp("age_as_of_date", { withTimezone: true }),
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
    check("child_profiles_age_months_check", sql`${table.ageMonths} is null or ${table.ageMonths} between 0 and 216`),
    check("child_profiles_birth_month_check", sql`${table.birthMonth} is null or ${table.birthMonth} between 1 and 12`),
    check("child_profiles_birth_year_check", sql`${table.birthYear} is null or ${table.birthYear} between 2016 and 2035`)
  ]
);


export const childProfileNotes = pgTable(
  "child_profile_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childProfileId: uuid("child_profile_id")
      .notNull()
      .references(() => childProfiles.id, { onDelete: "cascade" }),
    noteType: childProfileNoteTypeEnum("note_type").notNull().default("general"),
    title: varchar("title", { length: 100 }).notNull(),
    body: text("body"),
    isPinned: boolean("is_pinned").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("child_profile_notes_child_profile_id_idx").on(table.childProfileId),
    index("child_profile_notes_child_profile_archived_idx").on(table.childProfileId, table.isArchived),
    index("child_profile_notes_child_profile_pinned_idx").on(table.childProfileId, table.isPinned),
    check("child_profile_notes_title_not_blank_check", sql`length(trim(${table.title})) > 0`)
  ]
);

export const childProfileReminders = pgTable(
  "child_profile_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childProfileId: uuid("child_profile_id")
      .notNull()
      .references(() => childProfiles.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description"),
    reminderType: varchar("reminder_type", { length: 40 }).notNull().default("general"),
    scheduleKind: varchar("schedule_kind", { length: 40 }).notNull().default("one_time"),
    intervalMinutes: integer("interval_minutes"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    eventAt: timestamp("event_at", { withTimezone: true }),
    notifyBeforeMinutes: integer("notify_before_minutes"),
    localTime: varchar("local_time", { length: 5 }),
    timezone: varchar("timezone", { length: 80 }).notNull().default("Europe/Istanbul"),
    remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    channel: childProfileReminderChannelEnum("channel").notNull().default("in_app"),
    status: childProfileReminderStatusEnum("status").notNull().default("scheduled"),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("child_profile_reminders_child_profile_id_idx").on(table.childProfileId),
    index("child_profile_reminders_child_profile_status_idx").on(table.childProfileId, table.status),
    index("child_profile_reminders_remind_at_idx").on(table.remindAt),
    index("child_profile_reminders_next_run_at_idx").on(table.nextRunAt),
    check("child_profile_reminders_title_not_blank_check", sql`length(trim(${table.title})) > 0`),
    check("child_profile_reminders_schedule_kind_check", sql`${table.scheduleKind} in ('one_time', 'interval', 'daily', 'weekly', 'relative_before_event')`),
    check("child_profile_reminders_reminder_type_check", sql`${table.reminderType} in ('feeding', 'diaper', 'sleep', 'activity', 'shopping', 'appointment', 'general')`),
    check("child_profile_reminders_interval_minutes_check", sql`${table.intervalMinutes} is null or ${table.intervalMinutes} between 15 and 43200`),
    check("child_profile_reminders_notify_before_minutes_check", sql`${table.notifyBeforeMinutes} is null or ${table.notifyBeforeMinutes} between 1 and 43200`),
    check("child_profile_reminders_local_time_check", sql`${table.localTime} is null or ${table.localTime} ~ '^[0-2][0-9]:[0-5][0-9]$'`)
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

export const loginApprovalChallenges = pgTable(
  "login_approval_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    approvalTokenHash: text("approval_token_hash").notNull(),
    status: loginApprovalChallengeStatusEnum("status").notNull().default("pending"),
    requestUserAgent: text("request_user_agent"),
    requestIpAddress: text("request_ip_address"),
    approvedBySessionId: uuid("approved_by_session_id").references(() => sessions.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("login_approval_challenges_token_hash_unique").on(table.approvalTokenHash),
    index("login_approval_challenges_user_status_idx").on(table.userId, table.status),
    index("login_approval_challenges_expires_at_idx").on(table.expiresAt),
    index("login_approval_challenges_approved_by_session_idx").on(table.approvedBySessionId)
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
    publicationState: listingPublicationStateEnum("publication_state")
      .notNull()
      .default("awaiting_images"),
    publishAfter: timestamp("publish_after", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publicationReviewReason: text("publication_review_reason"),
    listingType: listingTypeEnum("listing_type").notNull().default("sale"),
    condition: listingConditionEnum("condition").notNull(),
    recommendedAgeMinMonths: integer("recommended_age_min_months"),
    recommendedAgeMaxMonths: integer("recommended_age_max_months"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("listings_seller_profile_id_idx").on(table.sellerProfileId),
    index("listings_category_id_idx").on(table.categoryId),
    index("listings_status_idx").on(table.status),
    index("listings_publication_state_idx").on(table.publicationState),
    index("listings_publish_after_idx").on(table.publishAfter),
    index("listings_recommended_age_range_idx").on(
      table.recommendedAgeMinMonths,
      table.recommendedAgeMaxMonths,
      table.publishedAt
    ),
    check(
      "listings_recommended_age_range_check",
      sql`(
        (${table.recommendedAgeMinMonths} is null and ${table.recommendedAgeMaxMonths} is null)
        or (
          ${table.recommendedAgeMinMonths} is not null
          and ${table.recommendedAgeMaxMonths} is not null
          and ${table.recommendedAgeMinMonths} between 0 and 216
          and ${table.recommendedAgeMaxMonths} between 0 and 216
          and ${table.recommendedAgeMinMonths} <= ${table.recommendedAgeMaxMonths}
        )
      )`
    ),
    check(
      "listings_public_lifecycle_publication_check",
      sql`(
        ${table.status} not in ('active', 'reserved', 'sold')
        or (
          ${table.publicationState} = 'published'
          and ${table.publishedAt} is not null
        )
      )`
    ),
    check(
      "listings_published_state_check",
      sql`(
        ${table.publicationState} <> 'published'
        or (
          ${table.status} in ('active', 'reserved', 'sold', 'archived')
          and ${table.publishedAt} is not null
        )
      )`
    ),
    check(
      "listings_scheduled_state_check",
      sql`(
        ${table.publicationState} <> 'scheduled'
        or (
          ${table.status} = 'draft'
          and ${table.publishAfter} is not null
        )
      )`
    ),
    check(
      "listings_publish_after_state_check",
      sql`(
        ${table.publishAfter} is null
        or (
          ${table.status} = 'draft'
          and ${table.publicationState} = 'scheduled'
        )
      )`
    )
  ]
);

export const marketplacePublicationSettings = pgTable(
  "marketplace_publication_settings",
  {
    id: integer("id").primaryKey().default(1),
    adminReviewEnabled: boolean("admin_review_enabled").notNull().default(false),
    autoPublishDelaySeconds: integer("auto_publish_delay_seconds").notNull().default(30),
    updatedByProfileId: uuid("updated_by_profile_id").references(() => profiles.id, {
      onDelete: "set null"
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("marketplace_publication_settings_singleton_check", sql`${table.id} = 1`),
    check(
      "marketplace_publication_settings_delay_check",
      sql`${table.autoPublishDelaySeconds} between 5 and 86400`
    )
  ]
);

export const shortLinks = pgTable(
  "short_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 12 }).notNull(),
    targetType: varchar("target_type", { length: 40 }).notNull(),
    targetId: uuid("target_id").notNull(),
    targetPath: text("target_path").notNull(),
    createdByProfileId: uuid("created_by_profile_id").references(() => profiles.id, { onDelete: "set null" }),
    source: varchar("source", { length: 80 }).notNull().default("listing_share"),
    clickCount: integer("click_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("short_links_code_unique").on(table.code),
    uniqueIndex("short_links_active_target_source_unique")
      .on(table.targetType, table.targetId, table.source)
      .where(sql`${table.isActive} = true and ${table.expiresAt} is null`),
    index("short_links_target_idx").on(table.targetType, table.targetId),
    index("short_links_created_by_profile_id_idx").on(table.createdByProfileId),
    index("short_links_active_code_idx").on(table.code, table.isActive),
    check("short_links_code_check", sql`${table.code} ~ '^[0-9A-Za-z]{6,12}$'`),
    check("short_links_target_type_check", sql`length(trim(${table.targetType})) > 0`),
    check("short_links_target_path_check", sql`length(trim(${table.targetPath})) > 0 and left(${table.targetPath}, 1) = '/'`),
    check("short_links_click_count_check", sql`${table.clickCount} >= 0`)
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
    contentHash: text("content_hash"),
    sortOrder: integer("sort_order").notNull().default(0),
    reviewStatus: listingImageReviewStatusEnum("review_status").notNull().default("approved"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByProfileId: uuid("reviewed_by_profile_id").references(() => profiles.id, {
      onDelete: "set null"
    }),
    authenticityProvider: varchar("authenticity_provider", { length: 120 }),
    authenticityModel: varchar("authenticity_model", { length: 160 }),
    authenticityPromptVersion: varchar("authenticity_prompt_version", { length: 160 }),
    authenticityDecision: varchar("authenticity_decision", { length: 40 }),
    authenticityConfidence: numeric("authenticity_confidence", { precision: 5, scale: 4 }),
    authenticityReasons: jsonb("authenticity_reasons").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    authenticityFlags: jsonb("authenticity_flags").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    authenticityCheckedAt: timestamp("authenticity_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("listing_images_listing_id_idx").on(table.listingId),
    index("listing_images_content_hash_idx").on(table.contentHash),
    uniqueIndex("listing_images_listing_content_hash_unique").on(table.listingId, table.contentHash),
    index("listing_images_review_status_idx").on(table.reviewStatus),
    index("listing_images_authenticity_decision_idx").on(table.authenticityDecision),
    index("listing_images_authenticity_checked_at_idx").on(table.authenticityCheckedAt)
  ]
);

export const accountDeletionStorageCleanupJobs = pgTable(
  "account_deletion_storage_cleanup_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id").notNull(),
    profileId: uuid("profile_id").references(() => profiles.id, {
      onDelete: "set null"
    }),
    listingId: uuid("listing_id").references(() => listings.id, {
      onDelete: "set null"
    }),
    url: text("url").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastErrorCode: varchar("last_error_code", { length: 80 }),
    lastErrorMessageRedacted: varchar("last_error_message_redacted", { length: 240 }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("account_deletion_storage_cleanup_batch_url_unique").on(
      table.batchId,
      table.url
    ),
    index("account_deletion_storage_cleanup_status_created_idx").on(
      table.status,
      table.createdAt
    ),
    index("account_deletion_storage_cleanup_batch_id_idx").on(table.batchId),
    index("account_deletion_storage_cleanup_profile_id_idx").on(table.profileId),
    check(
      "account_deletion_storage_cleanup_status_check",
      sql`${table.status} in ('pending', 'processing', 'completed', 'failed')`
    ),
    check(
      "account_deletion_storage_cleanup_attempt_count_check",
      sql`${table.attemptCount} >= 0`
    )
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

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    buyerProfileId: uuid("buyer_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("cart_items_buyer_listing_unique").on(table.buyerProfileId, table.listingId),
    index("cart_items_buyer_profile_id_idx").on(table.buyerProfileId),
    index("cart_items_listing_id_idx").on(table.listingId)
  ]
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    buyerProfileId: uuid("buyer_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    currency: varchar("currency", { length: 3 }).notNull().default("TRY"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
    paymentProvider: varchar("payment_provider", { length: 80 }).notNull().default("mock_iyzico"),
    providerPaymentId: varchar("provider_payment_id", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("orders_buyer_profile_id_idx").on(table.buyerProfileId),
    index("orders_status_idx").on(table.status),
    index("orders_provider_payment_id_idx").on(table.providerPaymentId)
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "restrict" }),
    sellerProfileId: uuid("seller_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    titleSnapshot: varchar("title_snapshot", { length: 160 }).notNull(),
    priceAmountSnapshot: numeric("price_amount_snapshot", { precision: 12, scale: 2 }).notNull().default("0.00"),
    currencySnapshot: varchar("currency_snapshot", { length: 3 }).notNull().default("TRY"),
    listingTypeSnapshot: varchar("listing_type_snapshot", { length: 40 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_listing_id_idx").on(table.listingId),
    index("order_items_seller_profile_id_idx").on(table.sellerProfileId)
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
    city: varchar("city", { length: 120 }),
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
    check("saved_searches_query_text_not_blank_check", sql`${table.queryText} is null or length(trim(${table.queryText})) > 0`),
    check("saved_searches_city_not_blank_check", sql`${table.city} is null or length(trim(${table.city})) > 0`)
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


export const notificationDeliveryLogs = pgTable(
  "notification_delivery_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 80 }).notNull(),
    sourceType: varchar("source_type", { length: 80 }).notNull(),
    sourceId: varchar("source_id", { length: 160 }).notNull(),
    channel: varchar("channel", { length: 40 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("candidate"),
    idempotencyKey: varchar("idempotency_key", { length: 240 }).notNull(),
    dedupKey: varchar("dedup_key", { length: 240 }).notNull(),
    frequencyWindowHours: integer("frequency_window_hours").notNull(),
    deliveryAllowed: boolean("delivery_allowed").notNull().default(false),
    draftOnly: boolean("draft_only").notNull().default(true),
    provider: varchar("provider", { length: 40 }),
    providerStatus: varchar("provider_status", { length: 40 }),
    providerMessageId: varchar("provider_message_id", { length: 160 }),
    claimToken: varchar("claim_token", { length: 64 }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    claimExpiresAt: timestamp("claim_expires_at", { withTimezone: true }),
    workerId: varchar("worker_id", { length: 120 }),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    lastErrorCode: varchar("last_error_code", { length: 80 }),
    lastErrorMessageRedacted: varchar("last_error_message_redacted", { length: 240 }),
    providerResponseMeta: jsonb("provider_response_meta").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    skippedReason: varchar("skipped_reason", { length: 120 }),
    blockedReasons: jsonb("blocked_reasons").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true })
  },
  (table) => [
    check(
      "notification_delivery_logs_status_check",
      sql`${table.status} in ('candidate', 'processing', 'blocked', 'sent', 'failed', 'skipped')`
    ),
    check(
      "notification_delivery_logs_channel_check",
      sql`${table.channel} in ('in_app', 'email_draft', 'email', 'push', 'n8n')`
    ),
    check(
      "notification_delivery_logs_kind_check",
      sql`${table.kind} in ('child_lifecycle', 'saved_search', 'child_reminder', 'security', 'message_received', 'listing_favorited')`
    ),
    check(
      "notification_delivery_logs_source_type_check",
      sql`${table.sourceType} in ('child_profile', 'saved_search', 'login_approval', 'conversation', 'listing')`
    ),
    uniqueIndex("notification_delivery_logs_idempotency_key_unique").on(table.idempotencyKey),
    index("notification_delivery_logs_profile_created_at_idx").on(table.profileId, table.createdAt),
    index("notification_delivery_logs_dedup_created_at_idx").on(table.dedupKey, table.createdAt),
    index("notification_delivery_logs_kind_source_idx").on(table.kind, table.sourceType, table.sourceId),
    index("notification_delivery_logs_provider_status_idx").on(table.provider, table.status, table.nextAttemptAt),
    index("notification_delivery_logs_claim_idx").on(table.status, table.claimExpiresAt, table.nextAttemptAt)
  ]
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    source: notificationPreferenceSourceEnum("source").notNull(),
    channel: notificationPreferenceChannelEnum("channel").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    mutedUntil: timestamp("muted_until", { withTimezone: true }),
    quietHoursStart: varchar("quiet_hours_start", { length: 5 }),
    quietHoursEnd: varchar("quiet_hours_end", { length: 5 }),
    timezone: varchar("timezone", { length: 80 }).notNull().default("Europe/Istanbul"),
    digest: varchar("digest", { length: 20 }).notNull().default("immediate"),
    reason: varchar("reason", { length: 240 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("notification_preferences_profile_source_channel_unique").on(
      table.profileId,
      table.source,
      table.channel
    ),
    index("notification_preferences_profile_id_idx").on(table.profileId),
    index("notification_preferences_source_channel_idx").on(table.source, table.channel)
  ]
);

export const notificationPreferenceAuditEvents = pgTable(
  "notification_preference_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    actorProfileId: uuid("actor_profile_id").references(() => profiles.id, { onDelete: "set null" }),
    source: notificationPreferenceSourceEnum("source").notNull(),
    channel: notificationPreferenceChannelEnum("channel").notNull(),
    oldEnabled: boolean("old_enabled"),
    newEnabled: boolean("new_enabled").notNull(),
    oldMutedUntil: timestamp("old_muted_until", { withTimezone: true }),
    newMutedUntil: timestamp("new_muted_until", { withTimezone: true }),
    oldDigest: varchar("old_digest", { length: 20 }),
    newDigest: varchar("new_digest", { length: 20 }),
    oldQuietHoursStart: varchar("old_quiet_hours_start", { length: 5 }),
    newQuietHoursStart: varchar("new_quiet_hours_start", { length: 5 }),
    oldQuietHoursEnd: varchar("old_quiet_hours_end", { length: 5 }),
    newQuietHoursEnd: varchar("new_quiet_hours_end", { length: 5 }),
    reason: varchar("reason", { length: 240 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("notification_preference_audit_profile_created_idx").on(table.profileId, table.createdAt),
    index("notification_preference_audit_source_channel_idx").on(table.source, table.channel)
  ]
);

export const notificationPushTokens = pgTable(
  "notification_push_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    tokenCiphertext: text("token_ciphertext"),
    tokenNonce: varchar("token_nonce", { length: 32 }),
    tokenTag: varchar("token_tag", { length: 32 }),
    platform: varchar("platform", { length: 20 }).notNull(),
    deviceLabel: varchar("device_label", { length: 120 }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("notification_push_tokens_profile_hash_unique").on(table.profileId, table.tokenHash),
    index("notification_push_tokens_profile_revoked_idx").on(table.profileId, table.revokedAt),
    check("notification_push_tokens_platform_check", sql`${table.platform} in ('ios', 'android', 'expo')`)
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

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: varchar("event_id", { length: 120 }).notNull(),
    eventName: varchar("event_name", { length: 120 }).notNull(),
    eventVersion: integer("event_version").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    platform: varchar("platform", { length: 20 }).notNull(),
    sessionId: varchar("session_id", { length: 160 }).notNull(),
    anonymousIdHash: varchar("anonymous_id_hash", { length: 128 }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
    pagePath: varchar("page_path", { length: 320 }),
    routeTemplate: varchar("route_template", { length: 240 }),
    screenName: varchar("screen_name", { length: 120 }),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    categoryId: uuid("category_id").references(() => productCategories.id, { onDelete: "set null" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    authProvider: varchar("auth_provider", { length: 40 }),
    engagementMs: integer("engagement_ms"),
    appVersion: varchar("app_version", { length: 80 }),
    properties: jsonb("properties")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    source: varchar("source", { length: 20 }).notNull().default("client"),
    environment: varchar("environment", { length: 40 }).notNull().default("development")
  },
  (table) => [
    uniqueIndex("analytics_events_event_id_unique").on(table.eventId),
    index("analytics_events_occurred_at_idx").on(table.occurredAt),
    index("analytics_events_name_occurred_at_idx").on(table.eventName, table.occurredAt),
    index("analytics_events_user_occurred_at_idx").on(table.userId, table.occurredAt),
    index("analytics_events_session_id_idx").on(table.sessionId),
    index("analytics_events_platform_occurred_at_idx").on(table.platform, table.occurredAt),
    index("analytics_events_category_occurred_at_idx").on(table.categoryId, table.occurredAt),
    index("analytics_events_listing_occurred_at_idx").on(table.listingId, table.occurredAt),
    index("analytics_events_conversation_occurred_at_idx").on(table.conversationId, table.occurredAt)
  ]
);

export const analyticsSessions = pgTable(
  "analytics_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: varchar("session_id", { length: 160 }).notNull(),
    anonymousIdHash: varchar("anonymous_id_hash", { length: 128 }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    platform: varchar("platform", { length: 20 }).notNull(),
    appVersion: varchar("app_version", { length: 80 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    activeEngagementMs: integer("active_engagement_ms").notNull().default(0),
    pageViewCount: integer("page_view_count").notNull().default(0),
    screenViewCount: integer("screen_view_count").notNull().default(0),
    listingViewCount: integer("listing_view_count").notNull().default(0),
    messageCount: integer("message_count").notNull().default(0),
    entrySurface: varchar("entry_surface", { length: 120 }),
    exitSurface: varchar("exit_surface", { length: 120 }),
    environment: varchar("environment", { length: 40 }).notNull().default("development")
  },
  (table) => [
    uniqueIndex("analytics_sessions_session_id_unique").on(table.sessionId),
    index("analytics_sessions_user_last_seen_idx").on(table.userId, table.lastSeenAt),
    index("analytics_sessions_platform_started_idx").on(table.platform, table.startedAt)
  ]
);

export const analyticsDailyOverview = pgTable(
  "analytics_daily_overview",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: varchar("date", { length: 10 }).notNull(),
    platform: varchar("platform", { length: 20 }).notNull(),
    totalUsers: integer("total_users").notNull().default(0),
    newUsers: integer("new_users").notNull().default(0),
    activeUsers: integer("active_users").notNull().default(0),
    sessions: integer("sessions").notNull().default(0),
    engagedMs: integer("engaged_ms").notNull().default(0),
    pageViews: integer("page_views").notNull().default(0),
    screenViews: integer("screen_views").notNull().default(0),
    listingViews: integer("listing_views").notNull().default(0),
    uniqueListingViewers: integer("unique_listing_viewers").notNull().default(0),
    favorites: integer("favorites").notNull().default(0),
    conversationsStarted: integer("conversations_started").notNull().default(0),
    messageSenders: integer("message_senders").notNull().default(0),
    messagesSent: integer("messages_sent").notNull().default(0),
    assistantUsers: integer("assistant_users").notNull().default(0),
    assistantQuestions: integer("assistant_questions").notNull().default(0),
    checkoutStarted: integer("checkout_started").notNull().default(0),
    checkoutCompleted: integer("checkout_completed").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("analytics_daily_overview_date_platform_unique").on(table.date, table.platform),
    index("analytics_daily_overview_date_idx").on(table.date)
  ]
);

export const analyticsDailyPages = pgTable(
  "analytics_daily_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: varchar("date", { length: 10 }).notNull(),
    platform: varchar("platform", { length: 20 }).notNull(),
    surface: varchar("surface", { length: 240 }).notNull(),
    views: integer("views").notNull().default(0),
    uniqueUsers: integer("unique_users").notNull().default(0),
    uniqueSessions: integer("unique_sessions").notNull().default(0),
    totalEngagedMs: integer("total_engaged_ms").notNull().default(0),
    averageEngagedMs: integer("average_engaged_ms").notNull().default(0),
    p50EngagedMs: integer("p50_engaged_ms").notNull().default(0),
    p90EngagedMs: integer("p90_engaged_ms").notNull().default(0),
    exits: integer("exits").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("analytics_daily_pages_date_platform_surface_unique").on(table.date, table.platform, table.surface),
    index("analytics_daily_pages_date_idx").on(table.date)
  ]
);

export const analyticsDailyCategories = pgTable(
  "analytics_daily_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: varchar("date", { length: 10 }).notNull(),
    platform: varchar("platform", { length: 20 }).notNull(),
    categoryId: uuid("category_id").references(() => productCategories.id, { onDelete: "set null" }),
    impressions: integer("impressions").notNull().default(0),
    listingViews: integer("listing_views").notNull().default(0),
    uniqueViewers: integer("unique_viewers").notNull().default(0),
    favorites: integer("favorites").notNull().default(0),
    conversationsStarted: integer("conversations_started").notNull().default(0),
    cartAdds: integer("cart_adds").notNull().default(0),
    checkoutCompleted: integer("checkout_completed").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("analytics_daily_categories_date_platform_category_unique").on(table.date, table.platform, table.categoryId),
    index("analytics_daily_categories_date_idx").on(table.date)
  ]
);

export const analyticsDailyAuth = pgTable(
  "analytics_daily_auth",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: varchar("date", { length: 10 }).notNull(),
    platform: varchar("platform", { length: 20 }).notNull(),
    authProvider: varchar("auth_provider", { length: 40 }).notNull(),
    registrations: integer("registrations").notNull().default(0),
    successfulLogins: integer("successful_logins").notNull().default(0),
    failedLogins: integer("failed_logins").notNull().default(0),
    emailVerifications: integer("email_verifications").notNull().default(0),
    mfaCompletions: integer("mfa_completions").notNull().default(0),
    approvalCompletions: integer("approval_completions").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("analytics_daily_auth_date_platform_provider_unique").on(table.date, table.platform, table.authProvider),
    index("analytics_daily_auth_date_idx").on(table.date)
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
  accountDeletionStorageCleanupJobs,
  aiModelRuns,
  authAccounts,
  blockedProfiles,
  cartItems,
  childProfiles,
  childProfileNotes,
  childProfileReminders,
  conversationListingContexts,
  conversationParticipants,
  conversations,
  emailVerificationTokens,
  events,
  favorites,
  listingImages,
  listings,
  loginApprovalChallenges,
  messages,
  marketplacePublicationSettings,
  mfaOtpChallenges,
  moderationActions,
  moderationCases,
  notifications,
  notificationPreferenceAuditEvents,
  notificationPreferences,
  notificationPushTokens,
  orderItems,
  orders,
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

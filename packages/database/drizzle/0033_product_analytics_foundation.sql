CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" varchar(120) NOT NULL,
  "event_name" varchar(120) NOT NULL,
  "event_version" integer NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "platform" varchar(20) NOT NULL,
  "session_id" varchar(160) NOT NULL,
  "anonymous_id_hash" varchar(128) NOT NULL,
  "user_id" uuid,
  "profile_id" uuid,
  "page_path" varchar(320),
  "route_template" varchar(240),
  "screen_name" varchar(120),
  "listing_id" uuid,
  "category_id" uuid,
  "conversation_id" uuid,
  "auth_provider" varchar(40),
  "engagement_ms" integer,
  "app_version" varchar(80),
  "properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source" varchar(20) DEFAULT 'client' NOT NULL,
  "environment" varchar(40) DEFAULT 'development' NOT NULL
);

CREATE TABLE IF NOT EXISTS "analytics_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" varchar(160) NOT NULL,
  "anonymous_id_hash" varchar(128) NOT NULL,
  "user_id" uuid,
  "platform" varchar(20) NOT NULL,
  "app_version" varchar(80),
  "started_at" timestamp with time zone NOT NULL,
  "last_seen_at" timestamp with time zone NOT NULL,
  "ended_at" timestamp with time zone,
  "active_engagement_ms" integer DEFAULT 0 NOT NULL,
  "page_view_count" integer DEFAULT 0 NOT NULL,
  "screen_view_count" integer DEFAULT 0 NOT NULL,
  "listing_view_count" integer DEFAULT 0 NOT NULL,
  "message_count" integer DEFAULT 0 NOT NULL,
  "entry_surface" varchar(120),
  "exit_surface" varchar(120),
  "environment" varchar(40) DEFAULT 'development' NOT NULL
);

CREATE TABLE IF NOT EXISTS "analytics_daily_overview" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "date" varchar(10) NOT NULL,
  "platform" varchar(20) NOT NULL,
  "total_users" integer DEFAULT 0 NOT NULL,
  "new_users" integer DEFAULT 0 NOT NULL,
  "active_users" integer DEFAULT 0 NOT NULL,
  "sessions" integer DEFAULT 0 NOT NULL,
  "engaged_ms" integer DEFAULT 0 NOT NULL,
  "page_views" integer DEFAULT 0 NOT NULL,
  "screen_views" integer DEFAULT 0 NOT NULL,
  "listing_views" integer DEFAULT 0 NOT NULL,
  "unique_listing_viewers" integer DEFAULT 0 NOT NULL,
  "favorites" integer DEFAULT 0 NOT NULL,
  "conversations_started" integer DEFAULT 0 NOT NULL,
  "message_senders" integer DEFAULT 0 NOT NULL,
  "messages_sent" integer DEFAULT 0 NOT NULL,
  "assistant_users" integer DEFAULT 0 NOT NULL,
  "assistant_questions" integer DEFAULT 0 NOT NULL,
  "checkout_started" integer DEFAULT 0 NOT NULL,
  "checkout_completed" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "analytics_daily_pages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "date" varchar(10) NOT NULL,
  "platform" varchar(20) NOT NULL,
  "surface" varchar(240) NOT NULL,
  "views" integer DEFAULT 0 NOT NULL,
  "unique_users" integer DEFAULT 0 NOT NULL,
  "unique_sessions" integer DEFAULT 0 NOT NULL,
  "total_engaged_ms" integer DEFAULT 0 NOT NULL,
  "average_engaged_ms" integer DEFAULT 0 NOT NULL,
  "p50_engaged_ms" integer DEFAULT 0 NOT NULL,
  "p90_engaged_ms" integer DEFAULT 0 NOT NULL,
  "exits" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "analytics_daily_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "date" varchar(10) NOT NULL,
  "platform" varchar(20) NOT NULL,
  "category_id" uuid,
  "impressions" integer DEFAULT 0 NOT NULL,
  "listing_views" integer DEFAULT 0 NOT NULL,
  "unique_viewers" integer DEFAULT 0 NOT NULL,
  "favorites" integer DEFAULT 0 NOT NULL,
  "conversations_started" integer DEFAULT 0 NOT NULL,
  "cart_adds" integer DEFAULT 0 NOT NULL,
  "checkout_completed" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "analytics_daily_auth" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "date" varchar(10) NOT NULL,
  "platform" varchar(20) NOT NULL,
  "auth_provider" varchar(40) NOT NULL,
  "registrations" integer DEFAULT 0 NOT NULL,
  "successful_logins" integer DEFAULT 0 NOT NULL,
  "failed_logins" integer DEFAULT 0 NOT NULL,
  "email_verifications" integer DEFAULT 0 NOT NULL,
  "mfa_completions" integer DEFAULT 0 NOT NULL,
  "approval_completions" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "analytics_sessions" ADD CONSTRAINT "analytics_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "analytics_daily_categories" ADD CONSTRAINT "analytics_daily_categories_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "analytics_events_event_id_unique" ON "analytics_events" USING btree ("event_id");
CREATE INDEX IF NOT EXISTS "analytics_events_occurred_at_idx" ON "analytics_events" USING btree ("occurred_at");
CREATE INDEX IF NOT EXISTS "analytics_events_name_occurred_at_idx" ON "analytics_events" USING btree ("event_name","occurred_at");
CREATE INDEX IF NOT EXISTS "analytics_events_user_occurred_at_idx" ON "analytics_events" USING btree ("user_id","occurred_at");
CREATE INDEX IF NOT EXISTS "analytics_events_session_id_idx" ON "analytics_events" USING btree ("session_id");
CREATE INDEX IF NOT EXISTS "analytics_events_platform_occurred_at_idx" ON "analytics_events" USING btree ("platform","occurred_at");
CREATE INDEX IF NOT EXISTS "analytics_events_category_occurred_at_idx" ON "analytics_events" USING btree ("category_id","occurred_at");
CREATE INDEX IF NOT EXISTS "analytics_events_listing_occurred_at_idx" ON "analytics_events" USING btree ("listing_id","occurred_at");
CREATE INDEX IF NOT EXISTS "analytics_events_conversation_occurred_at_idx" ON "analytics_events" USING btree ("conversation_id","occurred_at");
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_sessions_session_id_unique" ON "analytics_sessions" USING btree ("session_id");
CREATE INDEX IF NOT EXISTS "analytics_sessions_user_last_seen_idx" ON "analytics_sessions" USING btree ("user_id","last_seen_at");
CREATE INDEX IF NOT EXISTS "analytics_sessions_platform_started_idx" ON "analytics_sessions" USING btree ("platform","started_at");
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_daily_overview_date_platform_unique" ON "analytics_daily_overview" USING btree ("date","platform");
CREATE INDEX IF NOT EXISTS "analytics_daily_overview_date_idx" ON "analytics_daily_overview" USING btree ("date");
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_daily_pages_date_platform_surface_unique" ON "analytics_daily_pages" USING btree ("date","platform","surface");
CREATE INDEX IF NOT EXISTS "analytics_daily_pages_date_idx" ON "analytics_daily_pages" USING btree ("date");
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_daily_categories_date_platform_category_unique" ON "analytics_daily_categories" USING btree ("date","platform","category_id");
CREATE INDEX IF NOT EXISTS "analytics_daily_categories_date_idx" ON "analytics_daily_categories" USING btree ("date");
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_daily_auth_date_platform_provider_unique" ON "analytics_daily_auth" USING btree ("date","platform","auth_provider");
CREATE INDEX IF NOT EXISTS "analytics_daily_auth_date_idx" ON "analytics_daily_auth" USING btree ("date");

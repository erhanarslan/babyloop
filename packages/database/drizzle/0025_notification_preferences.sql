CREATE TYPE "notification_preference_source" AS ENUM (
  'child_reminder',
  'saved_search',
  'child_lifecycle',
  'marketplace',
  'messages',
  'trust_safety'
);
--> statement-breakpoint
CREATE TYPE "notification_preference_channel" AS ENUM (
  'in_app',
  'email',
  'push',
  'n8n'
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL,
  "source" "notification_preference_source" NOT NULL,
  "channel" "notification_preference_channel" NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "muted_until" timestamp with time zone,
  "reason" varchar(240),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preference_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL,
  "actor_profile_id" uuid,
  "source" "notification_preference_source" NOT NULL,
  "channel" "notification_preference_channel" NOT NULL,
  "old_enabled" boolean,
  "new_enabled" boolean NOT NULL,
  "old_muted_until" timestamp with time zone,
  "new_muted_until" timestamp with time zone,
  "reason" varchar(240),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_preference_audit_events" ADD CONSTRAINT "notification_preference_audit_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_preference_audit_events" ADD CONSTRAINT "notification_preference_audit_events_actor_profile_id_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "profiles"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_profile_source_channel_unique" ON "notification_preferences" USING btree ("profile_id","source","channel");
--> statement-breakpoint
CREATE INDEX "notification_preferences_profile_id_idx" ON "notification_preferences" USING btree ("profile_id");
--> statement-breakpoint
CREATE INDEX "notification_preferences_source_channel_idx" ON "notification_preferences" USING btree ("source","channel");
--> statement-breakpoint
CREATE INDEX "notification_preference_audit_profile_created_idx" ON "notification_preference_audit_events" USING btree ("profile_id","created_at");
--> statement-breakpoint
CREATE INDEX "notification_preference_audit_source_channel_idx" ON "notification_preference_audit_events" USING btree ("source","channel");

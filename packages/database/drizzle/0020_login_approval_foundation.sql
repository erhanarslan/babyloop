DO $$ BEGIN
  CREATE TYPE "public"."login_approval_challenge_status" AS ENUM('pending', 'approved', 'denied', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mobile_login_approval_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "login_approval_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "approval_token_hash" text NOT NULL,
  "status" "public"."login_approval_challenge_status" DEFAULT 'pending' NOT NULL,
  "request_user_agent" text,
  "request_ip_address" text,
  "approved_by_session_id" uuid,
  "expires_at" timestamp with time zone NOT NULL,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "login_approval_challenges" ADD CONSTRAINT "login_approval_challenges_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "login_approval_challenges" ADD CONSTRAINT "login_approval_challenges_approved_by_session_id_sessions_id_fk"
  FOREIGN KEY ("approved_by_session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "login_approval_challenges_token_hash_unique" ON "login_approval_challenges" USING btree ("approval_token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_approval_challenges_user_status_idx" ON "login_approval_challenges" USING btree ("user_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_approval_challenges_expires_at_idx" ON "login_approval_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_approval_challenges_approved_by_session_idx" ON "login_approval_challenges" USING btree ("approved_by_session_id");

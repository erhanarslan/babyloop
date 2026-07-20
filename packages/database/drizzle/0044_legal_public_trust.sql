CREATE TABLE IF NOT EXISTS "legal_acceptances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "document_type" varchar(40) NOT NULL,
  "document_version" varchar(40) NOT NULL,
  "source" varchar(40) NOT NULL,
  "accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "legal_acceptances_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade,
  CONSTRAINT "legal_acceptances_document_type_check"
    CHECK ("document_type" in ('terms')),
  CONSTRAINT "legal_acceptances_source_check"
    CHECK ("source" in ('web_password', 'mobile_password', 'google_oauth'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_acceptances_user_document_version_unique"
  ON "legal_acceptances" USING btree ("user_id", "document_type", "document_version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_acceptances_user_id_idx"
  ON "legal_acceptances" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_acceptances_accepted_at_idx"
  ON "legal_acceptances" USING btree ("accepted_at");

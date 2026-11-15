CREATE TABLE "bot"."mod_case" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bot"."mod_case_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"action" text NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"moderator_id" text NOT NULL,
	"moderator_name" text NOT NULL,
	"reason" text,
	"expires_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"log_channel_id" text,
	"log_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mod_case_user_id_idx" ON "bot"."mod_case" ("user_id");
-- Hand-edited: the migrator creates schema bot for its history table before this runs, and provisioning
-- creates it owned by the bot's role in production, so it may exist already.
CREATE SCHEMA IF NOT EXISTS "bot";
--> statement-breakpoint
CREATE TABLE "bot"."role_grant" (
	"discord_id" text,
	"role" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_grant_pkey" PRIMARY KEY("discord_id","role")
);
--> statement-breakpoint
CREATE TABLE "bot"."addon_message" (
	"addon_id" text PRIMARY KEY,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"posted_hash" text NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bot"."audit_post" (
	"event_id" bigint PRIMARY KEY,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot"."release_post" (
	"platform" text,
	"version" text,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_post_pkey" PRIMARY KEY("platform","version")
);
--> statement-breakpoint
CREATE TABLE "bot"."tag" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

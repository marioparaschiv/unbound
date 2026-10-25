CREATE TABLE "loader_release" (
	"platform" text,
	"version" text,
	"url" text NOT NULL,
	"changelog" text,
	"published_at" timestamp with time zone NOT NULL,
	"channel_id" text,
	"message_id" text,
	CONSTRAINT "loader_release_pkey" PRIMARY KEY("platform","version")
);
--> statement-breakpoint
CREATE TABLE "member" (
	"user_id" text PRIMARY KEY,
	"discord_id" text NOT NULL,
	"github_id" text,
	"github_login" text,
	"is_addon_developer" boolean NOT NULL,
	"is_sponsor" boolean NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_grant" (
	"discord_id" text,
	"role" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_grant_pkey" PRIMARY KEY("discord_id","role")
);
--> statement-breakpoint
CREATE TABLE "addon" (
	"id" text PRIMARY KEY,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"listed" boolean NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addon_message" (
	"addon_id" text PRIMARY KEY,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"posted_hash" text NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" bigint PRIMARY KEY,
	"kind" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"subject_name" text,
	"actor" jsonb,
	"data" jsonb,
	"reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"channel_id" text,
	"message_id" text
);
--> statement-breakpoint
CREATE TABLE "feed_cursor" (
	"feed" text PRIMARY KEY,
	"cursor" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addon_message" ADD CONSTRAINT "addon_message_addon_id_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "addon"("id") ON DELETE CASCADE;
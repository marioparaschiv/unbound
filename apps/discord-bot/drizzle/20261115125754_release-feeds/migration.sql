CREATE TABLE "bot"."api_release_post" (
	"version" text PRIMARY KEY,
	"channel_id" text NOT NULL,
	"message_id" text,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot"."bundle_post" (
	"bundle_channel" text,
	"version" text,
	"channel_id" text NOT NULL,
	"message_id" text,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bundle_post_pkey" PRIMARY KEY("bundle_channel","version")
);

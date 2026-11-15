CREATE TABLE "bot"."star_post" (
	"source_message_id" text PRIMARY KEY,
	"source_channel_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL UNIQUE,
	"posted_hash" text NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone
);

CREATE TABLE "bot"."review_notice" (
	"event_id" bigint PRIMARY KEY,
	"outcome" text NOT NULL,
	"message_id" text,
	"handled_at" timestamp with time zone DEFAULT now() NOT NULL
);

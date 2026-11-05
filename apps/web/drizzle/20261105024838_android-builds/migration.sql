CREATE TABLE "android_build" (
	"channel" text,
	"discord_version_code" integer,
	"commit" text,
	"discord_version" text NOT NULL,
	"splits" jsonb NOT NULL,
	"published_by" text,
	"published_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "android_build_pkey" PRIMARY KEY("channel","discord_version_code","commit")
);
--> statement-breakpoint
CREATE INDEX "android_build_channel_order_idx" ON "android_build" ("channel","discord_version_code","published_at");--> statement-breakpoint
ALTER TABLE "android_build" ADD CONSTRAINT "android_build_published_by_user_id_fkey" FOREIGN KEY ("published_by") REFERENCES "user"("id") ON DELETE SET NULL;
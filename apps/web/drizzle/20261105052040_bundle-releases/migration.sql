CREATE TABLE "bundle_release" (
	"channel" text,
	"version" text,
	"min_loader_version" text NOT NULL,
	"published_by" text,
	"published_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "bundle_release_pkey" PRIMARY KEY("channel","version")
);
--> statement-breakpoint
CREATE INDEX "bundle_release_channel_publishedAt_idx" ON "bundle_release" ("channel","published_at");--> statement-breakpoint
ALTER TABLE "bundle_release" ADD CONSTRAINT "bundle_release_published_by_user_id_fkey" FOREIGN KEY ("published_by") REFERENCES "user"("id") ON DELETE SET NULL;
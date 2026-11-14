CREATE TABLE "devtools_release" (
	"version" text PRIMARY KEY,
	"version_key" text NOT NULL,
	"assets" jsonb NOT NULL,
	"changelog" text,
	"published_by" text,
	"published_at" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "devtools_release_versionKey_idx" ON "devtools_release" ("version_key");--> statement-breakpoint
ALTER TABLE "devtools_release" ADD CONSTRAINT "devtools_release_published_by_user_id_fkey" FOREIGN KEY ("published_by") REFERENCES "user"("id") ON DELETE SET NULL;
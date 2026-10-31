CREATE TABLE "addon_tag" (
	"addon_id" text,
	"tag_id" text,
	CONSTRAINT "addon_tag_pkey" PRIMARY KEY("addon_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" text PRIMARY KEY,
	"label" text NOT NULL,
	"color" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "addon_tag_tagId_idx" ON "addon_tag" ("tag_id");--> statement-breakpoint
ALTER TABLE "addon_tag" ADD CONSTRAINT "addon_tag_addon_id_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "addon"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "addon_tag" ADD CONSTRAINT "addon_tag_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE;
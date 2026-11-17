ALTER TABLE "crash_report" ADD COLUMN "install_id" text;--> statement-breakpoint
CREATE INDEX "crash_report_addon_version_idx" ON "crash_report" ("addon_id","addon_version","received_at");
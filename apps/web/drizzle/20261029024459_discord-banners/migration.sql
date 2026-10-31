ALTER TABLE "discord_profile" ADD COLUMN "banner_hash" text;--> statement-breakpoint
ALTER TABLE "discord_profile" ADD COLUMN "guild_banner_hash" text;--> statement-breakpoint
-- Every cached profile predates banners, so mark them all stale and the refresher fetches each one's banner.
UPDATE "discord_profile" SET "fetched_at" = to_timestamp(0);
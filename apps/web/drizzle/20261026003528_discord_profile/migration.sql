CREATE TABLE `discord_profile` (
	`discord_id` text PRIMARY KEY,
	`username` text,
	`global_name` text,
	`avatar_hash` text,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `discord_profile_fetchedAt_idx` ON `discord_profile` (`fetched_at`);
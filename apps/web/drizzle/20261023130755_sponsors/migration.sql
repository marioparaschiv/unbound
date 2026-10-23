CREATE TABLE `perk_claim` (
	`user_id` text NOT NULL,
	`perk_id` text NOT NULL,
	`config` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revoked_at` integer,
	`revoked_by` text,
	`revoke_reason` text,
	CONSTRAINT `perk_claim_pk` PRIMARY KEY(`user_id`, `perk_id`),
	CONSTRAINT `fk_perk_claim_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_perk_claim_revoked_by_user_id_fk` FOREIGN KEY (`revoked_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `sponsor_webhook_delivery` (
	`id` text PRIMARY KEY,
	`action` text NOT NULL,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sponsorship` (
	`github_id` text PRIMARY KEY,
	`github_login` text NOT NULL,
	`state` text NOT NULL,
	`tier_name` text NOT NULL,
	`monthly_price_cents` integer NOT NULL,
	`one_time` integer NOT NULL,
	`since` integer NOT NULL,
	`ends_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sponsor_webhook_delivery_receivedAt_idx` ON `sponsor_webhook_delivery` (`received_at`);
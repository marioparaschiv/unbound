CREATE TABLE `loader_release` (
	`platform` text NOT NULL,
	`version` text NOT NULL,
	`version_key` text NOT NULL,
	`url` text NOT NULL,
	`changelog` text,
	`published_by` text,
	`published_at` integer NOT NULL,
	CONSTRAINT `loader_release_pk` PRIMARY KEY(`platform`, `version`),
	CONSTRAINT `fk_loader_release_published_by_user_id_fk` FOREIGN KEY (`published_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `loader_release_platform_versionKey_idx` ON `loader_release` (`platform`,`version_key`);
CREATE TABLE `bot_feed_change` (
	`feed` text NOT NULL,
	`key` text NOT NULL,
	`seq` integer NOT NULL,
	`changed_at` integer NOT NULL,
	CONSTRAINT `bot_feed_change_pk` PRIMARY KEY(`feed`, `key`)
);
--> statement-breakpoint
CREATE INDEX `bot_feed_change_feed_seq_idx` ON `bot_feed_change` (`feed`,`seq`,`key`);
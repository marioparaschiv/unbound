-- Admin search: trigram FTS5 mirrors of the text staff search by, read through `matchesSearch` in
-- `src/lib/admin-search.ts`. They are standalone tables keyed by id because a text primary key has no
-- stable rowid for external content. Triggers keep them in sync with every writer, Better Auth included.
-- A drizzle-kit rebuild of `user` or `addon` drops these triggers, so that migration must recreate them.
CREATE VIRTUAL TABLE `user_search` USING fts5(`id` UNINDEXED, `text`, tokenize = 'trigram');--> statement-breakpoint
CREATE TRIGGER `user_search_insert` AFTER INSERT ON `user` BEGIN
	INSERT INTO `user_search` (`id`, `text`) VALUES (new.`id`, new.`id` || ' ' || new.`name` || ' ' || new.`email`);
END;--> statement-breakpoint
CREATE TRIGGER `user_search_update` AFTER UPDATE OF `name`, `email` ON `user` BEGIN
	UPDATE `user_search` SET `text` = new.`id` || ' ' || new.`name` || ' ' || new.`email` WHERE `id` = old.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `user_search_delete` AFTER DELETE ON `user` BEGIN
	DELETE FROM `user_search` WHERE `id` = old.`id`;
END;--> statement-breakpoint
INSERT INTO `user_search` (`id`, `text`) SELECT `id`, `id` || ' ' || `name` || ' ' || `email` FROM `user`;--> statement-breakpoint
CREATE VIRTUAL TABLE `addon_search` USING fts5(`id` UNINDEXED, `text`, tokenize = 'trigram');--> statement-breakpoint
CREATE TRIGGER `addon_search_insert` AFTER INSERT ON `addon` BEGIN
	INSERT INTO `addon_search` (`id`, `text`) VALUES (new.`id`, new.`id` || ' ' || new.`name`);
END;--> statement-breakpoint
CREATE TRIGGER `addon_search_update` AFTER UPDATE OF `name` ON `addon` BEGIN
	UPDATE `addon_search` SET `text` = new.`id` || ' ' || new.`name` WHERE `id` = old.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `addon_search_delete` AFTER DELETE ON `addon` BEGIN
	DELETE FROM `addon_search` WHERE `id` = old.`id`;
END;--> statement-breakpoint
INSERT INTO `addon_search` (`id`, `text`) SELECT `id`, `id` || ' ' || `name` FROM `addon`;

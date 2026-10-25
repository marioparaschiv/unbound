-- Bot feeds: triggers move a key of `bot_feed_change` past every other key of its feed whenever one
-- of the feed's inputs changes, read through `src/lib/bot/feed.ts`. They catch every writer, Better
-- Auth included. A `seq` is assigned inside the writing transaction and SQLite has one writer, so seq
-- order is commit order and a reader paging by (seq, key) never skips a change.
-- A drizzle-kit rebuild of `addon`, `addon_version`, `addon_maintainer`, `account`, `user`,
-- `sponsorship` or `loader_release` drops these triggers, so that migration must recreate them.
CREATE TRIGGER `bot_feed_addon_insert` AFTER INSERT ON `addon` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('addons', new.`id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'addons'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
CREATE TRIGGER `bot_feed_addon_update` AFTER UPDATE ON `addon` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('addons', new.`id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'addons'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
-- Delisting and relisting change whether the addon's maintainers are addon developers.
CREATE TRIGGER `bot_feed_addon_listing` AFTER UPDATE OF `delisted_at` ON `addon` WHEN old.`delisted_at` IS NOT new.`delisted_at` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	SELECT 'members', `user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer)
	FROM `addon_maintainer` WHERE `addon_id` = new.`id`
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
CREATE TRIGGER `bot_feed_addon_version_insert` AFTER INSERT ON `addon_version` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('addons', new.`addon_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'addons'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	SELECT 'members', `user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer)
	FROM `addon_maintainer` WHERE `addon_id` = new.`addon_id`
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
CREATE TRIGGER `bot_feed_addon_version_withdraw` AFTER UPDATE OF `withdrawn_by` ON `addon_version` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('addons', new.`addon_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'addons'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	SELECT 'members', `user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer)
	FROM `addon_maintainer` WHERE `addon_id` = new.`addon_id`
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
CREATE TRIGGER `bot_feed_maintainer_insert` AFTER INSERT ON `addon_maintainer` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('members', new.`user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
CREATE TRIGGER `bot_feed_maintainer_delete` AFTER DELETE ON `addon_maintainer` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('members', old.`user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
CREATE TRIGGER `bot_feed_account_insert` AFTER INSERT ON `account` WHEN new.`provider_id` IN ('discord', 'github') BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('members', new.`user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
-- Token refreshes rewrite other columns on every sign-in; only these move a link.
CREATE TRIGGER `bot_feed_account_update` AFTER UPDATE OF `user_id`, `provider_id`, `account_id` ON `account` WHEN old.`provider_id` IN ('discord', 'github') OR new.`provider_id` IN ('discord', 'github') BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	SELECT 'members', `user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer)
	FROM (SELECT old.`user_id` AS `user_id` UNION SELECT new.`user_id`) WHERE true
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
CREATE TRIGGER `bot_feed_account_delete` AFTER DELETE ON `account` WHEN old.`provider_id` IN ('discord', 'github') BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('members', old.`user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
CREATE TRIGGER `bot_feed_user_delete` AFTER DELETE ON `user` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('members', old.`id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
CREATE TRIGGER `bot_feed_sponsorship_insert` AFTER INSERT ON `sponsorship` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	SELECT 'members', `user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer)
	FROM `account` WHERE `provider_id` = 'github' AND `account_id` = new.`github_id`
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
CREATE TRIGGER `bot_feed_sponsorship_update` AFTER UPDATE ON `sponsorship` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	SELECT 'members', `user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer)
	FROM `account` WHERE `provider_id` = 'github' AND `account_id` IN (old.`github_id`, new.`github_id`)
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
CREATE TRIGGER `bot_feed_sponsorship_delete` AFTER DELETE ON `sponsorship` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	SELECT 'members', `user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer)
	FROM `account` WHERE `provider_id` = 'github' AND `account_id` = old.`github_id`
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
CREATE TRIGGER `bot_feed_release_insert` AFTER INSERT ON `loader_release` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('releases', new.`platform` || ':' || new.`version`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'releases'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
CREATE TRIGGER `bot_feed_release_update` AFTER UPDATE ON `loader_release` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('releases', new.`platform` || ':' || new.`version`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'releases'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
CREATE TRIGGER `bot_feed_release_delete` AFTER DELETE ON `loader_release` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('releases', old.`platform` || ':' || old.`version`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'releases'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;--> statement-breakpoint
INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
SELECT 'addons', `id`, 1, cast(unixepoch('subsecond') * 1000 as integer) FROM `addon`;--> statement-breakpoint
INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
SELECT DISTINCT 'members', `user_id`, 1, cast(unixepoch('subsecond') * 1000 as integer) FROM `account` WHERE `provider_id` IN ('discord', 'github');--> statement-breakpoint
INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
SELECT 'releases', `platform` || ':' || `version`, 1, cast(unixepoch('subsecond') * 1000 as integer) FROM `loader_release`;

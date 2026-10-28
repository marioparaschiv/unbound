-- The apps/web SQLite schema as it stood before the move to Postgres: every migration in
-- apps/web/drizzle at commit f6f83612 applied to an empty database, then dumped without data, FTS5
-- shadow tables or sqlite_sequence (both recreated by the statements below).
CREATE TABLE `account` (
	`id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
CREATE TABLE `apikey` (
	`id` text PRIMARY KEY,
	`config_id` text DEFAULT 'default' NOT NULL,
	`name` text,
	`start` text,
	`reference_id` text NOT NULL,
	`prefix` text,
	`key` text NOT NULL,
	`refill_interval` integer,
	`refill_amount` integer,
	`last_refill_at` integer,
	`enabled` integer DEFAULT true,
	`rate_limit_enabled` integer DEFAULT true,
	`rate_limit_time_window` integer DEFAULT 86400000,
	`rate_limit_max` integer DEFAULT 1000,
	`request_count` integer DEFAULT 0,
	`remaining` integer,
	`last_request` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`permissions` text,
	`metadata` text
);
CREATE TABLE `device_code` (
	`id` text PRIMARY KEY,
	`device_code` text NOT NULL,
	`user_code` text NOT NULL,
	`user_id` text,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`last_polled_at` integer,
	`polling_interval` integer,
	`client_id` text,
	`scope` text
);
CREATE TABLE `rate_limit` (
	`id` text PRIMARY KEY,
	`key` text NOT NULL UNIQUE,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
CREATE TABLE `user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer
);
CREATE TABLE `verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);
CREATE INDEX `apikey_configId_idx` ON `apikey` (`config_id`);
CREATE INDEX `apikey_referenceId_idx` ON `apikey` (`reference_id`);
CREATE INDEX `apikey_key_idx` ON `apikey` (`key`);
CREATE UNIQUE INDEX `deviceCode_deviceCode_uidx` ON `device_code` (`device_code`);
CREATE UNIQUE INDEX `deviceCode_userCode_uidx` ON `device_code` (`user_code`);
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);
CREATE TABLE `addon` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`delisted_at` integer
, `type` text DEFAULT '' NOT NULL, `name` text DEFAULT '' NOT NULL, `description` text DEFAULT '' NOT NULL, `updated_at` integer DEFAULT 0 NOT NULL, `pinned_fields` integer DEFAULT 0 NOT NULL, `repository` text);
CREATE TABLE `addon_maintainer` (
	`addon_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `addon_maintainer_pk` PRIMARY KEY(`addon_id`, `user_id`),
	CONSTRAINT `fk_addon_maintainer_addon_id_addon_id_fk` FOREIGN KEY (`addon_id`) REFERENCES `addon`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_addon_maintainer_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
CREATE TABLE `addon_version` (
	`addon_id` text NOT NULL,
	`version` text NOT NULL,
	`submission_id` text NOT NULL,
	`manifest` text NOT NULL,
	`changelog` text,
	`bundle_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`published_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL, `version_key` text NOT NULL, `min_client_key` text NOT NULL, `withdrawn_by` integer REFERENCES moderation_event(id),
	CONSTRAINT `addon_version_pk` PRIMARY KEY(`addon_id`, `version`),
	CONSTRAINT `fk_addon_version_addon_id_addon_id_fk` FOREIGN KEY (`addon_id`) REFERENCES `addon`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_addon_version_submission_id_submission_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `submission`(`id`)
);
CREATE TABLE `submission` (
	`id` text PRIMARY KEY,
	`addon_id` text NOT NULL,
	`author_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`version` text NOT NULL,
	`manifest` text NOT NULL,
	`changelog` text,
	`repository` text,
	`bundle_size` integer NOT NULL,
	`staging_key` text NOT NULL UNIQUE,
	`sha256` text,
	`created_at` integer NOT NULL,
	`submitted_at` integer,
	`reviewer_id` text,
	`reviewed_at` integer,
	`review_note` text, `review_decision` text,
	CONSTRAINT `fk_submission_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_submission_reviewer_id_user_id_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
CREATE INDEX `addon_maintainer_userId_idx` ON `addon_maintainer` (`user_id`);
CREATE INDEX `submission_addonId_status_idx` ON `submission` (`addon_id`,`status`);
CREATE INDEX `submission_authorId_createdAt_idx` ON `submission` (`author_id`,`created_at`);
CREATE INDEX `addon_version_addonId_versionKey_idx` ON `addon_version` (`addon_id`,`version_key`);
CREATE INDEX `submission_status_submittedAt_idx` ON `submission` (`status`,`submitted_at`);
CREATE INDEX `addon_listed_name_idx` ON `addon` (`name`,`id`) WHERE "addon"."delisted_at" is null;
CREATE INDEX `addon_listed_type_name_idx` ON `addon` (`type`,`name`,`id`) WHERE "addon"."delisted_at" is null;
CREATE INDEX `addon_listed_createdAt_idx` ON `addon` (`created_at`,`id`) WHERE "addon"."delisted_at" is null;
CREATE INDEX `addon_listed_type_createdAt_idx` ON `addon` (`type`,`created_at`,`id`) WHERE "addon"."delisted_at" is null;
CREATE INDEX `addon_listed_updatedAt_idx` ON `addon` (`updated_at`,`id`) WHERE "addon"."delisted_at" is null;
CREATE INDEX `addon_listed_type_updatedAt_idx` ON `addon` (`type`,`updated_at`,`id`) WHERE "addon"."delisted_at" is null;
CREATE TABLE `sync_document` (
	`user_id` text PRIMARY KEY,
	`revision` integer NOT NULL,
	`document` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_sync_document_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
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
CREATE INDEX `loader_release_platform_versionKey_idx` ON `loader_release` (`platform`,`version_key`);
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
CREATE TABLE `sponsor_webhook_delivery` (
	`id` text PRIMARY KEY,
	`action` text NOT NULL,
	`received_at` integer NOT NULL
);
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
CREATE INDEX `sponsor_webhook_delivery_receivedAt_idx` ON `sponsor_webhook_delivery` (`received_at`);
CREATE TABLE `moderation_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`actor_id` text,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_moderation_event_actor_id_user_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
CREATE INDEX `moderation_event_subject_idx` ON `moderation_event` (`subject_type`,`subject_id`);
CREATE INDEX `addon_createdAt_idx` ON `addon` (`created_at`,`id`);
CREATE INDEX `user_createdAt_idx` ON `user` (`created_at`,`id`);
CREATE VIRTUAL TABLE `user_search` USING fts5(`id` UNINDEXED, `text`, tokenize = 'trigram');
CREATE TRIGGER `user_search_insert` AFTER INSERT ON `user` BEGIN
	INSERT INTO `user_search` (`id`, `text`) VALUES (new.`id`, new.`id` || ' ' || new.`name` || ' ' || new.`email`);
END;
CREATE TRIGGER `user_search_update` AFTER UPDATE OF `name`, `email` ON `user` BEGIN
	UPDATE `user_search` SET `text` = new.`id` || ' ' || new.`name` || ' ' || new.`email` WHERE `id` = old.`id`;
END;
CREATE TRIGGER `user_search_delete` AFTER DELETE ON `user` BEGIN
	DELETE FROM `user_search` WHERE `id` = old.`id`;
END;
CREATE VIRTUAL TABLE `addon_search` USING fts5(`id` UNINDEXED, `text`, tokenize = 'trigram');
CREATE TRIGGER `addon_search_insert` AFTER INSERT ON `addon` BEGIN
	INSERT INTO `addon_search` (`id`, `text`) VALUES (new.`id`, new.`id` || ' ' || new.`name`);
END;
CREATE TRIGGER `addon_search_update` AFTER UPDATE OF `name` ON `addon` BEGIN
	UPDATE `addon_search` SET `text` = new.`id` || ' ' || new.`name` WHERE `id` = old.`id`;
END;
CREATE TRIGGER `addon_search_delete` AFTER DELETE ON `addon` BEGIN
	DELETE FROM `addon_search` WHERE `id` = old.`id`;
END;
CREATE INDEX `addon_delisted_createdAt_idx` ON `addon` (`created_at`,`id`) WHERE "addon"."delisted_at" is not null;
CREATE INDEX `addon_version_live_idx` ON `addon_version` (`addon_id`,`version_key`) WHERE "addon_version"."withdrawn_by" is null;
CREATE TABLE `staff_note` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text,
	`addon_id` text,
	`author_id` text,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`edited_at` integer,
	CONSTRAINT `fk_staff_note_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_staff_note_addon_id_addon_id_fk` FOREIGN KEY (`addon_id`) REFERENCES `addon`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_staff_note_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "staff_note_one_subject" CHECK(("user_id" is null) <> ("addon_id" is null))
);
CREATE INDEX `staff_note_user_idx` ON `staff_note` (`user_id`) WHERE "staff_note"."user_id" is not null;
CREATE INDEX `staff_note_addon_idx` ON `staff_note` (`addon_id`) WHERE "staff_note"."addon_id" is not null;
CREATE TABLE `submission_source` (
	`submission_id` text PRIMARY KEY,
	`repository_id` integer NOT NULL,
	`path` text NOT NULL,
	`ref` text NOT NULL,
	`commit_sha` text NOT NULL,
	`bundle_path` text NOT NULL,
	`bundle_blob_sha` text NOT NULL,
	`addon_md` text,
	`changelog` text,
	`details` text NOT NULL,
	CONSTRAINT `fk_submission_source_submission_id_submission_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `submission`(`id`)
);
CREATE UNIQUE INDEX `submission_listing_claim_uidx` ON `submission` (`addon_id`) WHERE "submission"."kind" = 'listing' and "submission"."status" in ('pending_review', 'changes_requested');
CREATE TABLE `bot_feed_change` (
	`feed` text NOT NULL,
	`key` text NOT NULL,
	`seq` integer NOT NULL,
	`changed_at` integer NOT NULL,
	CONSTRAINT `bot_feed_change_pk` PRIMARY KEY(`feed`, `key`)
);
CREATE INDEX `bot_feed_change_feed_seq_idx` ON `bot_feed_change` (`feed`,`seq`,`key`);
CREATE TRIGGER `bot_feed_addon_insert` AFTER INSERT ON `addon` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('addons', new.`id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'addons'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TRIGGER `bot_feed_addon_update` AFTER UPDATE ON `addon` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('addons', new.`id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'addons'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TRIGGER `bot_feed_addon_listing` AFTER UPDATE OF `delisted_at` ON `addon` WHEN old.`delisted_at` IS NOT new.`delisted_at` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	SELECT 'members', `user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer)
	FROM `addon_maintainer` WHERE `addon_id` = new.`id`
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TRIGGER `bot_feed_addon_version_insert` AFTER INSERT ON `addon_version` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('addons', new.`addon_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'addons'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	SELECT 'members', `user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer)
	FROM `addon_maintainer` WHERE `addon_id` = new.`addon_id`
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TRIGGER `bot_feed_addon_version_withdraw` AFTER UPDATE OF `withdrawn_by` ON `addon_version` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('addons', new.`addon_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'addons'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	SELECT 'members', `user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer)
	FROM `addon_maintainer` WHERE `addon_id` = new.`addon_id`
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TRIGGER `bot_feed_maintainer_insert` AFTER INSERT ON `addon_maintainer` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('members', new.`user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TRIGGER `bot_feed_maintainer_delete` AFTER DELETE ON `addon_maintainer` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('members', old.`user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TRIGGER `bot_feed_account_insert` AFTER INSERT ON `account` WHEN new.`provider_id` IN ('discord', 'github') BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('members', new.`user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TRIGGER `bot_feed_account_update` AFTER UPDATE OF `user_id`, `provider_id`, `account_id` ON `account` WHEN old.`provider_id` IN ('discord', 'github') OR new.`provider_id` IN ('discord', 'github') BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	SELECT 'members', `user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer)
	FROM (SELECT old.`user_id` AS `user_id` UNION SELECT new.`user_id`) WHERE true
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TRIGGER `bot_feed_account_delete` AFTER DELETE ON `account` WHEN old.`provider_id` IN ('discord', 'github') BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('members', old.`user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TRIGGER `bot_feed_user_delete` AFTER DELETE ON `user` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('members', old.`id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TRIGGER `bot_feed_sponsorship_insert` AFTER INSERT ON `sponsorship` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	SELECT 'members', `user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer)
	FROM `account` WHERE `provider_id` = 'github' AND `account_id` = new.`github_id`
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TRIGGER `bot_feed_sponsorship_update` AFTER UPDATE ON `sponsorship` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	SELECT 'members', `user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer)
	FROM `account` WHERE `provider_id` = 'github' AND `account_id` IN (old.`github_id`, new.`github_id`)
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TRIGGER `bot_feed_sponsorship_delete` AFTER DELETE ON `sponsorship` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	SELECT 'members', `user_id`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'members'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer)
	FROM `account` WHERE `provider_id` = 'github' AND `account_id` = old.`github_id`
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TRIGGER `bot_feed_release_insert` AFTER INSERT ON `loader_release` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('releases', new.`platform` || ':' || new.`version`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'releases'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TRIGGER `bot_feed_release_update` AFTER UPDATE ON `loader_release` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('releases', new.`platform` || ':' || new.`version`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'releases'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TRIGGER `bot_feed_release_delete` AFTER DELETE ON `loader_release` BEGIN
	INSERT INTO `bot_feed_change` (`feed`, `key`, `seq`, `changed_at`)
	VALUES ('releases', old.`platform` || ':' || old.`version`, coalesce((SELECT max(`seq`) FROM `bot_feed_change` WHERE `feed` = 'releases'), 0) + 1, cast(unixepoch('subsecond') * 1000 as integer))
	ON CONFLICT (`feed`, `key`) DO UPDATE SET `seq` = excluded.`seq`, `changed_at` = excluded.`changed_at`;
END;
CREATE TABLE `discord_profile` (
	`discord_id` text PRIMARY KEY,
	`username` text,
	`global_name` text,
	`avatar_hash` text,
	`fetched_at` integer NOT NULL
);
CREATE INDEX `discord_profile_fetchedAt_idx` ON `discord_profile` (`fetched_at`);
CREATE TABLE `team_member` (
	`discord_id` text PRIMARY KEY,
	`group` text NOT NULL,
	`staff_role` text,
	`position` integer,
	`synced_at` integer NOT NULL
);
CREATE TABLE `crash_report` (
	`id` text PRIMARY KEY,
	`kind` text NOT NULL,
	`platform` text NOT NULL,
	`client_version` text NOT NULL,
	`loader_version` text NOT NULL,
	`discord_version` text NOT NULL,
	`os_version` text NOT NULL,
	`device_model` text NOT NULL,
	`addon_id` text,
	`addon_version` text,
	`addon_trust` text,
	`phase` text,
	`seconds` real,
	`message` text,
	`stack` text,
	`log` text,
	`received_at` integer NOT NULL
);
CREATE INDEX `crash_report_addonId_receivedAt_idx` ON `crash_report` (`addon_id`, `received_at`);
CREATE INDEX `crash_report_receivedAt_idx` ON `crash_report` (`received_at`);

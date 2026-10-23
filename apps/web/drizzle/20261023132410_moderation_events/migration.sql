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
--> statement-breakpoint
CREATE INDEX `moderation_event_subject_idx` ON `moderation_event` (`subject_type`,`subject_id`);--> statement-breakpoint
INSERT INTO `moderation_event` (`subject_type`, `subject_id`, `actor_id`, `kind`, `data`, `reason`, `created_at`)
SELECT
	'addon',
	`addon_id`,
	`reviewer_id`,
	'review.decided',
	json_object('submissionId', `id`, 'submissionKind', `kind`, 'version', `version`, 'decision', `review_decision`),
	`review_note`,
	`reviewed_at`
FROM `submission`
WHERE `review_decision` IS NOT NULL AND `reviewed_at` IS NOT NULL
ORDER BY `reviewed_at`, `id`;
ALTER TABLE `addon` ADD `pinned_fields` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `addon` ADD `repository` text;--> statement-breakpoint
UPDATE `addon` SET `repository` = (
	SELECT `repository` FROM `submission`
	WHERE `submission`.`addon_id` = `addon`.`id`
		AND `submission`.`status` = 'approved'
		AND `submission`.`repository` IS NOT NULL
	ORDER BY `submission`.`reviewed_at` DESC, `submission`.`id` DESC
	LIMIT 1
);

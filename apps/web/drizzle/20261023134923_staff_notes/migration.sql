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
--> statement-breakpoint
CREATE INDEX `staff_note_user_idx` ON `staff_note` (`user_id`) WHERE "staff_note"."user_id" is not null;--> statement-breakpoint
CREATE INDEX `staff_note_addon_idx` ON `staff_note` (`addon_id`) WHERE "staff_note"."addon_id" is not null;
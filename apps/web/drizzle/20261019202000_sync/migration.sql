CREATE TABLE `sync_document` (
	`user_id` text PRIMARY KEY,
	`revision` integer NOT NULL,
	`document` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_sync_document_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);

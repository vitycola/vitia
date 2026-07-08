ALTER TABLE `foods` ADD `data_basis` text;--> statement-breakpoint
CREATE TABLE `off_category_corrections` (
	`id` integer PRIMARY KEY NOT NULL,
	`correction_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);

CREATE TABLE `progress_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`date` text NOT NULL,
	`weight_kg` real,
	`neck_cm` real,
	`waist_cm` real,
	`hip_cm` real,
	`body_fat_pct` real,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `progress_entries_date_idx` ON `progress_entries` (`date`);
--> statement-breakpoint
CREATE TABLE `progress_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`blob` blob NOT NULL,
	`mime_type` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `progress_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `progress_photos_entry_idx` ON `progress_photos` (`entry_id`);

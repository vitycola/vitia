ALTER TABLE `users_profile` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `meal_entries` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `meal_entries` ADD `updated_at` text;--> statement-breakpoint
CREATE TABLE `sync_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`table` text NOT NULL,
	`op` text NOT NULL,
	`row` text NOT NULL,
	`user_id` text NOT NULL,
	`updated_at` text NOT NULL
);

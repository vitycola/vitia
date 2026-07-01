ALTER TABLE `foods` ADD `image_url` text;--> statement-breakpoint
CREATE TABLE `user_favorite_foods` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`food_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_favorite_foods_user_food_idx` ON `user_favorite_foods` (`user_id`,`food_id`);

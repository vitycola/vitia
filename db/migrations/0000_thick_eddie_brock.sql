CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`calories_per_100g` real NOT NULL,
	`protein_per_100g` real DEFAULT 0 NOT NULL,
	`carbs_per_100g` real DEFAULT 0 NOT NULL,
	`fat_per_100g` real DEFAULT 0 NOT NULL,
	`serving_size_g` real,
	`source` text NOT NULL,
	`off_product_code` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `foods_name_idx` ON `foods` (`name`);--> statement-breakpoint
CREATE INDEX `foods_off_code_idx` ON `foods` (`off_product_code`);--> statement-breakpoint
CREATE TABLE `meal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`meal_type` text NOT NULL,
	`food_id` text NOT NULL,
	`food_name` text NOT NULL,
	`quantity_g` real NOT NULL,
	`calories` real NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`logged_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `meal_entries_date_idx` ON `meal_entries` (`date`);--> statement-breakpoint
CREATE INDEX `meal_entries_date_meal_idx` ON `meal_entries` (`date`,`meal_type`);--> statement-breakpoint
CREATE TABLE `users_profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`age` integer NOT NULL,
	`height_cm` real NOT NULL,
	`weight_kg` real NOT NULL,
	`sex` text NOT NULL,
	`activity_level` text NOT NULL,
	`goal` text NOT NULL,
	`calorie_goal` real NOT NULL,
	`protein_goal_g` real NOT NULL,
	`carbs_goal_g` real NOT NULL,
	`fat_goal_g` real NOT NULL,
	`use_manual_goals` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);

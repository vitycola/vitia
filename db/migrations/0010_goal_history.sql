CREATE TABLE `goal_history` (
	`user_id` text NOT NULL,
	`effective_from` text NOT NULL,
	`calorie_goal` real NOT NULL,
	`protein_goal_g` real NOT NULL,
	`carbs_goal_g` real NOT NULL,
	`fat_goal_g` real NOT NULL,
	`use_manual_goals` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`user_id`, `effective_from`)
);

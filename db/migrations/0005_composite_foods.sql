CREATE TABLE `food_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_food_id` text NOT NULL,
	`ingredient_food_id` text NOT NULL,
	`weight_g` real NOT NULL,
	`position` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`parent_food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingredient_food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `food_ingredients_parent_idx` ON `food_ingredients` (`parent_food_id`);
--> statement-breakpoint
ALTER TABLE `foods` ADD `category` text;

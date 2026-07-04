ALTER TABLE `user_favorite_foods` ADD `meal_type` text;--> statement-breakpoint
DROP INDEX IF EXISTS `user_favorite_foods_user_food_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_favorite_foods_user_food_meal_idx` ON `user_favorite_foods` (`user_id`,`food_id`,`meal_type`);

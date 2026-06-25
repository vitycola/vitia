ALTER TABLE `foods` ADD `name_normalized` text NOT NULL DEFAULT '';--> statement-breakpoint
CREATE INDEX `foods_name_normalized_idx` ON `foods` (`name_normalized`);

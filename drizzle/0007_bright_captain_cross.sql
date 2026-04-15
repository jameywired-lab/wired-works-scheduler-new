ALTER TABLE `followUps` ADD `remindAt` bigint;--> statement-breakpoint
ALTER TABLE `followUps` ADD `clientContacted` boolean DEFAULT false NOT NULL;
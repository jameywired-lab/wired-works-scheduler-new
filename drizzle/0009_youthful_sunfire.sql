CREATE TABLE `projectCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`key` varchar(128) NOT NULL,
	`label` varchar(255) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectCredentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projectCredentials` ADD CONSTRAINT `projectCredentials_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;
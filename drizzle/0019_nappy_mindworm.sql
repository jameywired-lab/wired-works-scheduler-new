CREATE TABLE `projectNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`authorName` varchar(255) DEFAULT 'Admin',
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectPhotos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`s3Key` varchar(512) NOT NULL,
	`s3Url` text NOT NULL,
	`filename` varchar(255),
	`mimeType` varchar(64),
	`sizeBytes` int,
	`uploadedBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectPhotos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projectNotes` ADD CONSTRAINT `projectNotes_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectPhotos` ADD CONSTRAINT `projectPhotos_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;
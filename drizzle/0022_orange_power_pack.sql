CREATE TABLE `clientNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`authorName` varchar(255) NOT NULL DEFAULT 'Admin',
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clientNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clientPhotos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`s3Key` varchar(512) NOT NULL,
	`s3Url` text NOT NULL,
	`filename` varchar(255),
	`mimeType` varchar(64),
	`sizeBytes` int,
	`uploadedBy` varchar(255) NOT NULL DEFAULT 'Admin',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clientPhotos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `clientNotes` ADD CONSTRAINT `clientNotes_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clientPhotos` ADD CONSTRAINT `clientPhotos_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;
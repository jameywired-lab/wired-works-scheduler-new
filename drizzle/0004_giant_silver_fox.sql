CREATE TABLE `jobPhotos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`s3Key` varchar(512) NOT NULL,
	`s3Url` text NOT NULL,
	`filename` varchar(255),
	`mimeType` varchar(64),
	`sizeBytes` int,
	`uploadedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobPhotos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `jobPhotos` ADD CONSTRAINT `jobPhotos_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE no action ON UPDATE no action;
CREATE TABLE `jobDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`s3Key` varchar(512) NOT NULL,
	`s3Url` text NOT NULL,
	`filename` varchar(255) NOT NULL,
	`mimeType` varchar(128) NOT NULL DEFAULT 'application/octet-stream',
	`sizeBytes` int,
	`uploadedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `jobPhotos` ADD `annotatedS3Key` varchar(512);--> statement-breakpoint
ALTER TABLE `jobPhotos` ADD `annotatedS3Url` text;--> statement-breakpoint
ALTER TABLE `jobDocuments` ADD CONSTRAINT `jobDocuments_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE no action ON UPDATE no action;
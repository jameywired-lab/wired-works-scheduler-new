CREATE TABLE `salesPipeline` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int,
	`clientName` varchar(255) NOT NULL,
	`phone` varchar(50),
	`email` varchar(255),
	`stage` enum('new_lead','proposal_needed','proposal_sent','follow_up','won','lost') NOT NULL DEFAULT 'new_lead',
	`notes` text,
	`estimatedValue` bigint,
	`reminderAt` bigint,
	`reminderNote` text,
	`sourceFollowUpId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salesPipeline_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `salesPipeline` ADD CONSTRAINT `salesPipeline_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;
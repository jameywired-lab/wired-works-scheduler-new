ALTER TABLE `followUps` MODIFY COLUMN `type` enum('call','text','manual','closeout','proposal') NOT NULL DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `followUps` ADD `linkedJobId` int;--> statement-breakpoint
ALTER TABLE `followUps` ADD `clientId` int;--> statement-breakpoint
ALTER TABLE `followUps` ADD `proposalStatus` enum('none','pending','accepted','declined','not_ready') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `followUps` ADD `proposalSentAt` bigint;--> statement-breakpoint
ALTER TABLE `followUps` ADD `isUrgent` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `followUps` ADD `urgentAt` bigint;--> statement-breakpoint
ALTER TABLE `jobs` ADD `jobType` enum('service_call','project_job','sales_call') DEFAULT 'service_call' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `closeoutNotes` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `closeoutOutcome` enum('client_happy_bill','client_issue_urgent','proposal_needed','bill_service_call');--> statement-breakpoint
ALTER TABLE `jobs` ADD `closedAt` bigint;--> statement-breakpoint
ALTER TABLE `followUps` ADD CONSTRAINT `followUps_linkedJobId_jobs_id_fk` FOREIGN KEY (`linkedJobId`) REFERENCES `jobs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `followUps` ADD CONSTRAINT `followUps_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;
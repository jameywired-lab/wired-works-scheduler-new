CREATE TABLE IF NOT EXISTS `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin','crew') NOT NULL DEFAULT 'user',
	`passwordHash` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
CREATE TABLE IF NOT EXISTS `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(32),
	`email` varchar(320),
	`addressLine1` varchar(255),
	`addressLine2` varchar(255),
	`city` varchar(128),
	`state` varchar(64),
	`zip` varchar(20),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `crewMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`name` varchar(255) NOT NULL,
	`phone` varchar(32),
	`email` varchar(320),
	`role` varchar(128) DEFAULT 'Technician',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crewMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `crewNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`crewMemberId` int,
	`authorName` varchar(255),
	`content` text NOT NULL,
	`credentials` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crewNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `jobAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`crewMemberId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
	`scheduledStart` bigint NOT NULL,
	`scheduledEnd` bigint NOT NULL,
	`address` varchar(512),
	`ownerInstructions` text,
	`bookingSmsSent` boolean NOT NULL DEFAULT false,
	`reminderSmsSent` boolean NOT NULL DEFAULT false,
	`reviewSmsSent` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `smsLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int,
	`clientId` int,
	`toPhone` varchar(32) NOT NULL,
	`messageType` enum('booking','reminder','review') NOT NULL,
	`body` text NOT NULL,
	`status` varchar(64) DEFAULT 'sent',
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `smsLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','crew') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `crewMembers` ADD CONSTRAINT `crewMembers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `crewNotes` ADD CONSTRAINT `crewNotes_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `crewNotes` ADD CONSTRAINT `crewNotes_crewMemberId_crewMembers_id_fk` FOREIGN KEY (`crewMemberId`) REFERENCES `crewMembers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jobAssignments` ADD CONSTRAINT `jobAssignments_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jobAssignments` ADD CONSTRAINT `jobAssignments_crewMemberId_crewMembers_id_fk` FOREIGN KEY (`crewMemberId`) REFERENCES `crewMembers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `smsLog` ADD CONSTRAINT `smsLog_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `smsLog` ADD CONSTRAINT `smsLog_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;CREATE TABLE IF NOT EXISTS `clientAddresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`label` varchar(64) NOT NULL DEFAULT 'Home',
	`addressLine1` varchar(255) NOT NULL,
	`addressLine2` varchar(255),
	`city` varchar(128),
	`state` varchar(64),
	`zip` varchar(20),
	`isPrimary` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientAddresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `googleTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`expiresAt` bigint NOT NULL,
	`calendarId` varchar(255) DEFAULT 'primary',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `googleTokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `jobs` ADD `googleCalendarEventId` varchar(255);--> statement-breakpoint
ALTER TABLE `clientAddresses` ADD CONSTRAINT `clientAddresses_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `googleTokens` ADD CONSTRAINT `googleTokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;CREATE TABLE IF NOT EXISTS `followUps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactName` varchar(255),
	`phone` varchar(32),
	`type` enum('call','text','manual') NOT NULL DEFAULT 'manual',
	`note` text,
	`isFollowedUp` boolean NOT NULL DEFAULT false,
	`contactedAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `followUps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `projectMilestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`isComplete` boolean NOT NULL DEFAULT false,
	`dueDate` bigint,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectMilestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `projectReminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`message` text NOT NULL,
	`remindAt` bigint NOT NULL,
	`isDismissed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectReminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('active','on_hold','completed','cancelled') NOT NULL DEFAULT 'active',
	`startDate` bigint,
	`dueDate` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projectMilestones` ADD CONSTRAINT `projectMilestones_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectReminders` ADD CONSTRAINT `projectReminders_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;CREATE TABLE IF NOT EXISTS `jobPhotos` (
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
ALTER TABLE `jobPhotos` ADD CONSTRAINT `jobPhotos_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE no action ON UPDATE no action;CREATE TABLE IF NOT EXISTS `clientTags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`tagId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clientTags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`color` varchar(32) NOT NULL DEFAULT '#6366f1',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `clientTags` ADD CONSTRAINT `clientTags_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clientTags` ADD CONSTRAINT `clientTags_tagId_tags_id_fk` FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON DELETE no action ON UPDATE no action;ALTER TABLE `followUps` MODIFY COLUMN `type` enum('call','text','manual','closeout','proposal') NOT NULL DEFAULT 'manual';--> statement-breakpoint
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
ALTER TABLE `followUps` ADD CONSTRAINT `followUps_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;ALTER TABLE `followUps` ADD `remindAt` bigint;--> statement-breakpoint
ALTER TABLE `followUps` ADD `clientContacted` boolean DEFAULT false NOT NULL;CREATE TABLE IF NOT EXISTS `jobDocuments` (
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
ALTER TABLE `jobDocuments` ADD CONSTRAINT `jobDocuments_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE no action ON UPDATE no action;CREATE TABLE IF NOT EXISTS `projectCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`key` varchar(128) NOT NULL,
	`label` varchar(255) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectCredentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projectCredentials` ADD CONSTRAINT `projectCredentials_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;CREATE TABLE IF NOT EXISTS `vanInventoryItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`targetQty` int NOT NULL DEFAULT 1,
	`currentQty` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vanInventoryItems_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `partsRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestedBy` varchar(255) NOT NULL DEFAULT 'Crew',
	`partDescription` text NOT NULL,
	`smsSent` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partsRequests_id` PRIMARY KEY(`id`)
);
ALTER TABLE `followUps` MODIFY COLUMN `type` enum('call','text','manual','closeout','proposal','inventory') NOT NULL DEFAULT 'manual';ALTER TABLE `projectMilestones` ADD `weight` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `projectType` enum('new_construction','commercial','retrofit');ALTER TABLE `projectCredentials` MODIFY COLUMN `projectId` int;--> statement-breakpoint
ALTER TABLE `projectCredentials` ADD `clientId` int;--> statement-breakpoint
ALTER TABLE `projectCredentials` ADD CONSTRAINT `projectCredentials_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;CREATE TABLE IF NOT EXISTS `clientCommunications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int,
	`direction` enum('inbound','outbound') NOT NULL DEFAULT 'inbound',
	`channel` enum('sms','email','call','note') NOT NULL DEFAULT 'note',
	`subject` varchar(255),
	`body` text,
	`fromAddress` varchar(255),
	`toAddress` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clientCommunications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `emailCampaignRecipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`clientId` int,
	`email` varchar(255) NOT NULL,
	`clientName` varchar(255),
	`status` enum('sent','failed','pending') NOT NULL DEFAULT 'pending',
	`sentAt` timestamp,
	CONSTRAINT `emailCampaignRecipients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `emailCampaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subject` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`tagFilter` varchar(50),
	`recipientCount` int NOT NULL DEFAULT 0,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emailCampaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `clientCommunications` ADD CONSTRAINT `clientCommunications_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emailCampaignRecipients` ADD CONSTRAINT `emailCampaignRecipients_campaignId_emailCampaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `emailCampaigns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emailCampaignRecipients` ADD CONSTRAINT `emailCampaignRecipients_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;CREATE TABLE IF NOT EXISTS `smsTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`body` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smsTemplates_id` PRIMARY KEY(`id`),
	CONSTRAINT `smsTemplates_key_unique` UNIQUE(`key`)
);
ALTER TABLE `projects` ADD `projectValue` decimal(12,2);--> statement-breakpoint
ALTER TABLE `projects` ADD `completedAt` bigint;ALTER TABLE `projects` ADD `jobTotal` decimal(12,2);--> statement-breakpoint
ALTER TABLE `projects` ADD `leadSource` varchar(64);--> statement-breakpoint
ALTER TABLE `projects` ADD `referralName` varchar(255);--> statement-breakpoint
ALTER TABLE `projects` ADD `leadSourceOther` varchar(255);CREATE TABLE IF NOT EXISTS `projectNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`authorName` varchar(255) DEFAULT 'Admin',
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `projectPhotos` (
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
ALTER TABLE `projectPhotos` ADD CONSTRAINT `projectPhotos_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;ALTER TABLE `followUps` ADD `messageCount` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `followUps` ADD `messages` text;CREATE TABLE IF NOT EXISTS `activityLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` enum('delete','complete','update') NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int NOT NULL,
	`entityLabel` varchar(512),
	`snapshotJson` text NOT NULL,
	`performedAt` timestamp NOT NULL DEFAULT (now()),
	`undoneAt` timestamp,
	CONSTRAINT `activityLog_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `clientNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`authorName` varchar(255) NOT NULL DEFAULT 'Admin',
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clientNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `clientPhotos` (
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
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','crew') NOT NULL DEFAULT 'user';

ALTER TABLE `users` ADD `phone` varchar(32);
ALTER TABLE `followUps` ADD `nextStepsNote` text;
CREATE TABLE IF NOT EXISTS `callLog` (
	`id` int AUTO_INCREMENT PRIMARY KEY,
	`openPhoneCallId` varchar(255),
	`from` varchar(50) NOT NULL,
	`to` varchar(50) NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL DEFAULT 'inbound',
	`status` enum('completed','missed','voicemail','no-answer','busy','failed') NOT NULL DEFAULT 'completed',
	`duration` int,
	`recordingUrl` text,
	`transcription` text,
	`clientId` int,
	`contactName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

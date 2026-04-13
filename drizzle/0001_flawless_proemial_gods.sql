CREATE TABLE `clients` (
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
CREATE TABLE `crewMembers` (
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
CREATE TABLE `crewNotes` (
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
CREATE TABLE `jobAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`crewMemberId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
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
CREATE TABLE `smsLog` (
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
ALTER TABLE `smsLog` ADD CONSTRAINT `smsLog_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;
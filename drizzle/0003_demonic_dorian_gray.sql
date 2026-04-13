CREATE TABLE `followUps` (
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
CREATE TABLE `projectMilestones` (
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
CREATE TABLE `projectReminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`message` text NOT NULL,
	`remindAt` bigint NOT NULL,
	`isDismissed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectReminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
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
ALTER TABLE `projects` ADD CONSTRAINT `projects_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;
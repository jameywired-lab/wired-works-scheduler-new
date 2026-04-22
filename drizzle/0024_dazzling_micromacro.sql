CREATE TABLE `crewPermissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`crewMemberId` int NOT NULL,
	`canViewCalendar` boolean NOT NULL DEFAULT true,
	`canViewClients` boolean NOT NULL DEFAULT true,
	`canCloseOutJobs` boolean NOT NULL DEFAULT true,
	`canAddNotes` boolean NOT NULL DEFAULT true,
	`canAddPhotos` boolean NOT NULL DEFAULT true,
	`canViewProjects` boolean NOT NULL DEFAULT true,
	`canViewVanInventory` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crewPermissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `crewPermissions_crewMemberId_unique` UNIQUE(`crewMemberId`)
);
--> statement-breakpoint
CREATE TABLE `crewTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignedToCrewMemberId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`dueDate` bigint,
	`isComplete` boolean NOT NULL DEFAULT false,
	`completedAt` bigint,
	`createdBy` varchar(255) DEFAULT 'Admin',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crewTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `crewPermissions` ADD CONSTRAINT `crewPermissions_crewMemberId_crewMembers_id_fk` FOREIGN KEY (`crewMemberId`) REFERENCES `crewMembers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `crewTasks` ADD CONSTRAINT `crewTasks_assignedToCrewMemberId_crewMembers_id_fk` FOREIGN KEY (`assignedToCrewMemberId`) REFERENCES `crewMembers`(`id`) ON DELETE cascade ON UPDATE no action;
CREATE TABLE `activityLog` (
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

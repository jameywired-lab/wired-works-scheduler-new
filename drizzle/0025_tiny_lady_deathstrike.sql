CREATE TABLE `appNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text,
	`type` enum('inbound_sms','inbound_call','task_complete','job_update','general') NOT NULL DEFAULT 'general',
	`relatedId` int,
	`relatedType` varchar(64),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `appNotifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `callLog` (
	`id` int AUTO_INCREMENT NOT NULL,
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
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `callLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inboundSmsLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openPhoneMessageId` varchar(255),
	`from` varchar(50) NOT NULL,
	`to` varchar(50) NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL DEFAULT 'inbound',
	`body` text NOT NULL,
	`clientId` int,
	`contactName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inboundSmsLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `callLog` ADD CONSTRAINT `callLog_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inboundSmsLog` ADD CONSTRAINT `inboundSmsLog_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;
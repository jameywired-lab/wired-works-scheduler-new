CREATE TABLE `clientCommunications` (
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
CREATE TABLE `emailCampaignRecipients` (
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
CREATE TABLE `emailCampaigns` (
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
ALTER TABLE `emailCampaignRecipients` ADD CONSTRAINT `emailCampaignRecipients_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;
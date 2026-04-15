CREATE TABLE `smsTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`body` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smsTemplates_id` PRIMARY KEY(`id`),
	CONSTRAINT `smsTemplates_key_unique` UNIQUE(`key`)
);

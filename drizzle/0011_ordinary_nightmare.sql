CREATE TABLE `partsRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestedBy` varchar(255) NOT NULL DEFAULT 'Crew',
	`partDescription` text NOT NULL,
	`smsSent` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partsRequests_id` PRIMARY KEY(`id`)
);

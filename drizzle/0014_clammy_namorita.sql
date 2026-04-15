ALTER TABLE `projectCredentials` MODIFY COLUMN `projectId` int;--> statement-breakpoint
ALTER TABLE `projectCredentials` ADD `clientId` int;--> statement-breakpoint
ALTER TABLE `projectCredentials` ADD CONSTRAINT `projectCredentials_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;
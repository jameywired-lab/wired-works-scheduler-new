ALTER TABLE `callLog` RENAME COLUMN `from` TO `fromNumber`;--> statement-breakpoint
ALTER TABLE `callLog` RENAME COLUMN `to` TO `toNumber`;--> statement-breakpoint
ALTER TABLE `inboundSmsLog` RENAME COLUMN `from` TO `fromNumber`;--> statement-breakpoint
ALTER TABLE `inboundSmsLog` RENAME COLUMN `to` TO `toNumber`;
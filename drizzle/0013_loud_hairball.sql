ALTER TABLE `projectMilestones` ADD `weight` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `projectType` enum('new_construction','commercial','retrofit');
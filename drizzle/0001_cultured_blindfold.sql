CREATE TABLE `sync_changes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`changeId` varchar(128) NOT NULL,
	`deviceId` varchar(128) NOT NULL,
	`userId` int NOT NULL,
	`recordType` varchar(64) NOT NULL,
	`recordId` varchar(191) NOT NULL,
	`operation` enum('upsert','delete') NOT NULL,
	`payload` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sync_changes_id` PRIMARY KEY(`id`),
	CONSTRAINT `sync_changes_changeId_unique` UNIQUE(`changeId`)
);
--> statement-breakpoint
CREATE TABLE `sync_devices` (
	`deviceId` varchar(128) NOT NULL,
	`userId` int NOT NULL,
	`deviceLabel` varchar(255),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastSyncAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sync_devices_deviceId` PRIMARY KEY(`deviceId`)
);
--> statement-breakpoint
CREATE TABLE `sync_records` (
	`recordType` varchar(64) NOT NULL,
	`recordId` varchar(191) NOT NULL,
	`payload` text NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`updatedBy` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `sync_records_record_key_unique` UNIQUE(`recordType`,`recordId`)
);
--> statement-breakpoint
CREATE INDEX `sync_changes_device_idx` ON `sync_changes` (`deviceId`,`id`);--> statement-breakpoint
CREATE INDEX `sync_changes_record_idx` ON `sync_changes` (`recordType`,`recordId`,`id`);--> statement-breakpoint
CREATE INDEX `sync_devices_user_idx` ON `sync_devices` (`userId`);--> statement-breakpoint
CREATE INDEX `sync_records_type_version_idx` ON `sync_records` (`recordType`,`version`);
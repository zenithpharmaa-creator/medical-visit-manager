CREATE TABLE `sync_activation_codes` (
	`codeHash` varchar(128) NOT NULL,
	`representativeId` varchar(128) NOT NULL,
	`createdBy` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`usedDeviceId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sync_activation_codes_codeHash` PRIMARY KEY(`codeHash`)
);
--> statement-breakpoint
ALTER TABLE `sync_devices` ADD `representativeId` varchar(128);--> statement-breakpoint
ALTER TABLE `sync_devices` ADD `tokenHash` varchar(128);--> statement-breakpoint
UPDATE `sync_devices` SET `tokenHash` = SHA2(CONCAT(`deviceId`, ':legacy-device-token'), 256) WHERE `tokenHash` IS NULL;--> statement-breakpoint
ALTER TABLE `sync_devices` MODIFY `tokenHash` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `sync_devices` ADD `revokedAt` timestamp;--> statement-breakpoint
CREATE INDEX `sync_activation_representative_idx` ON `sync_activation_codes` (`representativeId`);--> statement-breakpoint
CREATE INDEX `sync_activation_expiry_idx` ON `sync_activation_codes` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `sync_devices_representative_idx` ON `sync_devices` (`representativeId`);
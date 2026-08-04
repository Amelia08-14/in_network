CREATE TABLE `expert_connection_requests` (
    `id` VARCHAR(191) NOT NULL,
    `requesterUserId` VARCHAR(191) NOT NULL,
    `expertProfileId` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `expert_connection_requests_requesterUserId_createdAt_idx`(`requesterUserId`, `createdAt`),
    INDEX `expert_connection_requests_expertProfileId_status_idx`(`expertProfileId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `expert_connection_requests`
    ADD CONSTRAINT `expert_connection_requests_requesterUserId_fkey`
    FOREIGN KEY (`requesterUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `expert_connection_requests`
    ADD CONSTRAINT `expert_connection_requests_expertProfileId_fkey`
    FOREIGN KEY (`expertProfileId`) REFERENCES `expert_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

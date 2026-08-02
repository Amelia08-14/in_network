-- DropForeignKey
ALTER TABLE `service_requests` DROP FOREIGN KEY `service_requests_serviceId_fkey`;

-- DropForeignKey
ALTER TABLE `service_requests` DROP FOREIGN KEY `service_requests_userId_fkey`;

-- AlterTable
ALTER TABLE `gallery_images` ADD COLUMN `type` ENUM('IMAGE', 'VIDEO') NOT NULL DEFAULT 'IMAGE';

-- AlterTable
ALTER TABLE `service_requests` ADD COLUMN `guestCompany` VARCHAR(191) NULL,
    ADD COLUMN `guestEmail` VARCHAR(191) NULL,
    ADD COLUMN `guestName` VARCHAR(191) NULL,
    ADD COLUMN `guestPhone` VARCHAR(191) NULL,
    ADD COLUMN `planId` VARCHAR(191) NULL,
    ADD COLUMN `spaceId` VARCHAR(191) NULL,
    ADD COLUMN `targetType` ENUM('SERVICE', 'SPACE', 'PLAN') NOT NULL DEFAULT 'SERVICE',
    MODIFY `userId` VARCHAR(191) NULL,
    MODIFY `serviceId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `testimonials` ADD COLUMN `thumbnailUrl` VARCHAR(191) NULL,
    ADD COLUMN `videoUrl` VARCHAR(191) NULL,
    MODIFY `content` TEXT NULL;

-- CreateIndex
CREATE INDEX `service_requests_targetType_idx` ON `service_requests`(`targetType`);

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `service_catalog_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_spaceId_fkey` FOREIGN KEY (`spaceId`) REFERENCES `space_resources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `membership_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

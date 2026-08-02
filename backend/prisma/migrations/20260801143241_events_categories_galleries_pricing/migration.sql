/*
  Warnings:

  - You are about to drop the column `isPublished` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `dailyRate` on the `space_resources` table. All the data in the column will be lost.
  - You are about to drop the column `hourlyRate` on the `space_resources` table. All the data in the column will be lost.
  - Added the required column `displayName` to the `expert_profiles` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `events` DROP FOREIGN KEY `events_siteId_fkey`;

-- AlterTable
ALTER TABLE `events` DROP COLUMN `isPublished`,
    ADD COLUMN `coOrganizerLogoUrl` VARCHAR(191) NULL,
    ADD COLUMN `coOrganizerName` VARCHAR(191) NULL,
    ADD COLUMN `location` VARCHAR(191) NULL,
    ADD COLUMN `origin` ENUM('IN_EVENT', 'EXTERNAL', 'CO_ORGANIZED') NOT NULL DEFAULT 'IN_EVENT',
    ADD COLUMN `status` ENUM('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    MODIFY `siteId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `expert_profiles` ADD COLUMN `bio` TEXT NULL,
    ADD COLUMN `displayName` VARCHAR(191) NOT NULL,
    ADD COLUMN `order` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `photoUrl` VARCHAR(191) NULL,
    MODIFY `userId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `service_catalog_items` ADD COLUMN `pricingTiers` JSON NULL,
    MODIFY `category` ENUM('DOMICILIATION', 'CREATION_ENTREPRISE', 'COMPTABILITE', 'JURIDIQUE', 'MARKETING', 'SECRETARIAT', 'AUTRE') NOT NULL;

-- AlterTable
ALTER TABLE `space_resources` DROP COLUMN `dailyRate`,
    DROP COLUMN `hourlyRate`,
    ADD COLUMN `dailyRateExternal` DECIMAL(10, 2) NULL,
    ADD COLUMN `dailyRateMember` DECIMAL(10, 2) NULL,
    ADD COLUMN `halfDayRateExternal` DECIMAL(10, 2) NULL,
    ADD COLUMN `halfDayRateMember` DECIMAL(10, 2) NULL,
    ADD COLUMN `hourlyRateExternal` DECIMAL(10, 2) NULL,
    ADD COLUMN `hourlyRateMember` DECIMAL(10, 2) NULL;

-- CreateTable
CREATE TABLE `gallery_images` (
    `id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `altText` VARCHAR(191) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `ownerType` ENUM('EVENT', 'SITE') NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gallery_images_ownerType_ownerId_idx`(`ownerType`, `ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `partners` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `logoUrl` VARCHAR(191) NOT NULL,
    `sector` VARCHAR(191) NOT NULL,
    `websiteUrl` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `events_origin_status_idx` ON `events`(`origin`, `status`);

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Demande de devis sous forme de panier (demande client 19/09/2026) : une
-- ServiceRequest porte désormais plusieurs lignes (service_request_items) au
-- lieu d'une cible unique. Les anciennes demandes sont reprises en lignes
-- avant de supprimer les colonnes de cible unique.

-- AlterTable : nouvelle famille « Administration » (formation, RH…)
ALTER TABLE `service_catalog_items` MODIFY `category` ENUM('DOMICILIATION', 'CREATION_ENTREPRISE', 'ADMINISTRATION', 'COMPTABILITE', 'JURIDIQUE', 'MARKETING', 'SECRETARIAT', 'AUTRE') NOT NULL;

-- CreateTable
CREATE TABLE `service_request_items` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `targetType` ENUM('SERVICE', 'SPACE', 'PLAN') NOT NULL,
    `serviceId` VARCHAR(191) NULL,
    `spaceId` VARCHAR(191) NULL,
    `planId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `tierLabel` VARCHAR(191) NULL,
    `unitPrice` DECIMAL(10, 2) NULL,
    `priceUnit` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `service_request_items_requestId_idx`(`requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `service_request_items` ADD CONSTRAINT `service_request_items_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `service_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_request_items` ADD CONSTRAINT `service_request_items_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `service_catalog_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_request_items` ADD CONSTRAINT `service_request_items_spaceId_fkey` FOREIGN KEY (`spaceId`) REFERENCES `space_resources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_request_items` ADD CONSTRAINT `service_request_items_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `membership_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Reprise des demandes existantes : une ligne par ancienne demande, avec le
-- libellé de la cible (et le prix pour une formule d'abonnement).
INSERT INTO `service_request_items` (`id`, `requestId`, `targetType`, `serviceId`, `spaceId`, `planId`, `title`, `unitPrice`, `priceUnit`, `createdAt`)
SELECT
    CONCAT('bf_', sr.`id`),
    sr.`id`,
    sr.`targetType`,
    sr.`serviceId`,
    sr.`spaceId`,
    sr.`planId`,
    COALESCE(s.`title`, sp.`name`, p.`name`, 'Demande'),
    p.`price`,
    CAST(p.`billingCycle` AS CHAR),
    sr.`createdAt`
FROM `service_requests` sr
LEFT JOIN `service_catalog_items` s ON s.`id` = sr.`serviceId`
LEFT JOIN `space_resources` sp ON sp.`id` = sr.`spaceId`
LEFT JOIN `membership_plans` p ON p.`id` = sr.`planId`;

-- DropForeignKey
ALTER TABLE `service_requests` DROP FOREIGN KEY `service_requests_planId_fkey`;

-- DropForeignKey
ALTER TABLE `service_requests` DROP FOREIGN KEY `service_requests_serviceId_fkey`;

-- DropForeignKey
ALTER TABLE `service_requests` DROP FOREIGN KEY `service_requests_spaceId_fkey`;

-- DropIndex
DROP INDEX `service_requests_planId_fkey` ON `service_requests`;

-- DropIndex
DROP INDEX `service_requests_serviceId_fkey` ON `service_requests`;

-- DropIndex
DROP INDEX `service_requests_spaceId_fkey` ON `service_requests`;

-- DropIndex
DROP INDEX `service_requests_targetType_idx` ON `service_requests`;

-- AlterTable
ALTER TABLE `service_requests` DROP COLUMN `planId`,
    DROP COLUMN `serviceId`,
    DROP COLUMN `spaceId`,
    DROP COLUMN `targetType`;

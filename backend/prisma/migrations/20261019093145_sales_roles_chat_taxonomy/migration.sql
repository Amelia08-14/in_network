-- AlterTable
ALTER TABLE `leads` ADD COLUMN `assignedAt` DATETIME(3) NULL,
    ADD COLUMN `priority` ENUM('COLD', 'WARM', 'HOT') NULL,
    ADD COLUMN `qualification` JSON NULL,
    ADD COLUMN `qualifiedAt` DATETIME(3) NULL,
    ADD COLUMN `qualifiedById` VARCHAR(191) NULL,
    MODIFY `stage` ENUM('NEW', 'QUALIFIED', 'ASSIGNED', 'CONTACTED', 'QUOTE_SENT', 'WON', 'LOST') NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE `service_catalog_items` MODIFY `category` ENUM('DOMICILIATION', 'CREATION_ENTREPRISE', 'ADMINISTRATION', 'COMPTABILITE', 'JURIDIQUE', 'MARKETING', 'SECRETARIAT', 'OFFRE', 'DIASPORA', 'INCUBATION', 'AUTRE') NOT NULL;

-- AlterTable
ALTER TABLE `tags` ADD COLUMN `group` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN', 'OFFICE_MANAGER', 'SALES_MANAGER', 'SALES_AGENT', 'MEMBER') NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE `messages` (
    `id` VARCHAR(191) NOT NULL,
    `connectionId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `messages_connectionId_createdAt_idx`(`connectionId`, `createdAt`),
    INDEX `messages_senderId_idx`(`senderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `tags_category_group_idx` ON `tags`(`category`, `group`);

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `connection_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_qualifiedById_fkey` FOREIGN KEY (`qualifiedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Reprise des leads existants dans le nouveau parcours
-- (NEW → QUALIFIED → ASSIGNED → CONTACTED → QUOTE_SENT → WON/LOST).
-- Un ancien « Qualifié » venait après le premier contact : il devient « Contacté ».
-- Un lead « Nouveau » déjà confié à un commercial devient « Assigné » ;
-- les leads « Nouveau » sans commercial restent à qualifier.
UPDATE `leads` SET `stage` = 'CONTACTED' WHERE `stage` = 'QUALIFIED';
UPDATE `leads` SET `stage` = 'ASSIGNED', `assignedAt` = `updatedAt` WHERE `stage` = 'NEW' AND `assignedToId` IS NOT NULL;

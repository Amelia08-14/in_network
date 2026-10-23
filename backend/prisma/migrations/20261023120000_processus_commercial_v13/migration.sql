-- Processus commercial IN NETWORK v1.3 (23/10/2026) : circuits, pipelines,
-- nouvelles étapes du lead, proforma, pôles et panier de services,
-- commissions, paramètres. Les données existantes sont reprises en fin de
-- fichier (et, pour les leads, entre les deux changements d'enum).

-- AlterTable
ALTER TABLE `appointments` MODIFY `type` ENUM('CALL', 'VISIT', 'VIDEO', 'TRIAL_DAY', 'MEETING') NOT NULL DEFAULT 'MEETING';

-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `proformaNumber` VARCHAR(191) NULL,
    ADD COLUMN `refundReason` VARCHAR(191) NULL,
    ADD COLUMN `refundedAt` DATETIME(3) NULL,
    MODIFY `status` ENUM('DRAFT', 'SENT', 'PAID', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable (étape 1/3 : nouvelles colonnes ; les enums stage / source
-- acceptent temporairement anciennes ET nouvelles valeurs, le temps de
-- reprendre les données existantes).
ALTER TABLE `leads` ADD COLUMN `channel` ENUM('LINKEDIN', 'SOCIAL_MEDIA', 'WEBSITE', 'ADVERTISING', 'COLD_MAILING', 'WORKSHOP', 'OPEN_DAY', 'IN_TALK', 'MEMBER_REFERRAL', 'ACCOUNTANT', 'LAWYER', 'SCHOOL', 'INCUBATOR', 'LMIG_SUBSIDIARY', 'DIASPORA_FRANCE', 'DIASPORA_CANADA', 'DIASPORA_UAE', 'WHATSAPP', 'DIRECT_MESSAGE', 'WALK_IN', 'PHONE') NULL,
    ADD COLUMN `channelDetail` VARCHAR(191) NULL,
    ADD COLUMN `circuit` ENUM('SALES_TEAM', 'OFFICE_MANAGER') NULL,
    ADD COLUMN `confirmedAt` DATETIME(3) NULL,
    ADD COLUMN `dispatchedAt` DATETIME(3) NULL,
    ADD COLUMN `followUpCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `followUpReturnedAt` DATETIME(3) NULL,
    ADD COLUMN `handedOverAt` DATETIME(3) NULL,
    ADD COLUMN `kind` ENUM('NEW_BUSINESS', 'EXTENSION', 'RENEWAL') NOT NULL DEFAULT 'NEW_BUSINESS',
    ADD COLUMN `offerInterest` VARCHAR(191) NULL,
    ADD COLUMN `parentLeadId` VARCHAR(191) NULL,
    ADD COLUMN `pipeline` ENUM('DIGITAL', 'COMMUNITY', 'PARTNERS', 'DIASPORA_DIRECT') NULL,
    ADD COLUMN `referrerUserId` VARCHAR(191) NULL,
    ADD COLUMN `salesAgentId` VARCHAR(191) NULL,
    MODIFY `source` ENUM('REGISTRATION', 'WEBSITE_QUOTE', 'CONTACT_FORM', 'PHONE', 'VISIT', 'REFERRAL', 'EVENT', 'OTHER', 'MEMBER_SPACE', 'MEMBER_REFERRAL', 'AD_FORM', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    MODIFY `stage` ENUM('NEW', 'QUALIFIED', 'CONTACTED', 'WON', 'REGISTERED', 'ASSIGNED', 'FOLLOW_UP', 'VISIT_CONFIRMED', 'QUOTE_SENT', 'CONFIRMED', 'PAID', 'LOST') NOT NULL DEFAULT 'REGISTERED';

-- Étape 2/3 : reprise des leads existants dans le processus v1.3.
-- Canal et pipeline depuis l'ancienne source ; la source ne garde que
-- l'origine technique (formulaires du site) ou « saisie manuelle ».
UPDATE `leads` SET `pipeline` = 'DIGITAL', `channel` = 'WEBSITE' WHERE `source` IN ('REGISTRATION', 'WEBSITE_QUOTE', 'CONTACT_FORM');
UPDATE `leads` SET `pipeline` = 'DIASPORA_DIRECT', `channel` = 'PHONE' WHERE `source` = 'PHONE';
UPDATE `leads` SET `pipeline` = 'DIASPORA_DIRECT', `channel` = 'WALK_IN' WHERE `source` = 'VISIT';
UPDATE `leads` SET `pipeline` = 'PARTNERS' WHERE `source` = 'REFERRAL';
UPDATE `leads` SET `pipeline` = 'COMMUNITY' WHERE `source` = 'EVENT';
UPDATE `leads` SET `source` = 'MANUAL' WHERE `source` IN ('PHONE', 'VISIT', 'REFERRAL', 'EVENT', 'OTHER');

-- Circuit : un lead confié à un compte commercial est en circuit 1 (ce compte
-- devient son commercial Sales Team) ; confié à un autre compte (office
-- manager, administrateur), en circuit 2. Un ancien « À assigner » (validé,
-- sans commercial) attendait la Sales Team : circuit 1, à attribuer.
UPDATE `leads` l JOIN `users` u ON u.`id` = l.`assignedToId`
  SET l.`circuit` = 'SALES_TEAM', l.`salesAgentId` = l.`assignedToId`, l.`dispatchedAt` = COALESCE(l.`assignedAt`, l.`updatedAt`)
  WHERE u.`role` IN ('SALES_AGENT', 'SALES_MANAGER');
UPDATE `leads` l JOIN `users` u ON u.`id` = l.`assignedToId`
  SET l.`circuit` = 'OFFICE_MANAGER', l.`dispatchedAt` = COALESCE(l.`assignedAt`, l.`updatedAt`)
  WHERE u.`role` NOT IN ('SALES_AGENT', 'SALES_MANAGER', 'MEMBER');
UPDATE `leads` SET `circuit` = 'SALES_TEAM', `dispatchedAt` = COALESCE(`qualifiedAt`, `updatedAt`) WHERE `stage` = 'QUALIFIED' AND `assignedToId` IS NULL;

-- Étapes : À qualifier / À assigner → Lead enregistré ; Contacté → Qualifié ;
-- Gagné → Paiement confirmé ; un devis accepté → Confirmé.
UPDATE `leads` SET `stage` = 'REGISTERED' WHERE `stage` IN ('NEW', 'QUALIFIED');
UPDATE `leads` SET `stage` = 'QUALIFIED' WHERE `stage` = 'CONTACTED';
UPDATE `leads` SET `stage` = 'PAID' WHERE `stage` = 'WON';
UPDATE `leads` l SET l.`stage` = 'CONFIRMED', l.`confirmedAt` = (SELECT MAX(q.`acceptedAt`) FROM `quotes` q WHERE q.`leadId` = l.`id` AND q.`status` = 'ACCEPTED')
  WHERE l.`stage` = 'QUOTE_SENT' AND EXISTS (SELECT 1 FROM `quotes` q WHERE q.`leadId` = l.`id` AND q.`status` = 'ACCEPTED');

-- Étape 3/3 : enums définitifs.
ALTER TABLE `leads`
    MODIFY `source` ENUM('REGISTRATION', 'WEBSITE_QUOTE', 'CONTACT_FORM', 'MEMBER_SPACE', 'MEMBER_REFERRAL', 'AD_FORM', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    MODIFY `stage` ENUM('REGISTERED', 'ASSIGNED', 'QUALIFIED', 'FOLLOW_UP', 'VISIT_CONFIRMED', 'QUOTE_SENT', 'CONFIRMED', 'PAID', 'LOST') NOT NULL DEFAULT 'REGISTERED';

-- AlterTable
ALTER TABLE `quote_lines` ADD COLUMN `renewsOrderId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `invoice_lines` ADD COLUMN `renewsOrderId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `quotes` ADD COLUMN `approvedAt` DATETIME(3) NULL,
    ADD COLUMN `approvedById` VARCHAR(191) NULL,
    ADD COLUMN `confirmedVia` ENUM('PLATFORM', 'EMAIL') NULL,
    MODIFY `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE `service_catalog_items` ADD COLUMN `durationMonths` INTEGER NULL,
    ADD COLUMN `pole` ENUM('SPACES', 'COMPANY_CREATION', 'IN_GROUP') NOT NULL DEFAULT 'SPACES',
    ADD COLUMN `subsidiary` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `service_orders` ADD COLUMN `adjustmentNote` TEXT NULL,
    ADD COLUMN `alert30At` DATETIME(3) NULL,
    ADD COLUMN `alert60At` DATETIME(3) NULL,
    ADD COLUMN `alert7At` DATETIME(3) NULL,
    ADD COLUMN `amount` DECIMAL(12, 2) NULL,
    ADD COLUMN `expiredAt` DATETIME(3) NULL,
    ADD COLUMN `expiresAt` DATETIME(3) NULL,
    ADD COLUMN `pole` ENUM('SPACES', 'COMPANY_CREATION', 'IN_GROUP') NOT NULL DEFAULT 'SPACES',
    ADD COLUMN `readyAt` DATETIME(3) NULL,
    ADD COLUMN `renewedFromId` VARCHAR(191) NULL,
    ADD COLUMN `startsAt` DATETIME(3) NULL,
    ADD COLUMN `subsidiary` VARCHAR(191) NULL,
    ADD COLUMN `validatedById` VARCHAR(191) NULL,
    MODIFY `status` ENUM('TO_START', 'IN_PROGRESS', 'AWAITING_VALIDATION', 'ADJUSTMENT_REQUESTED', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'TO_START';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `isExternal` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `referentId` VARCHAR(191) NULL,
    ADD COLUMN `salesProfile` ENUM('SEDENTARY', 'FIELD') NULL,
    MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN', 'OFFICE_MANAGER', 'SALES_MANAGER', 'SALES_AGENT', 'ADMIN_SUPPORT', 'MEMBER') NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE `lead_circuit_changes` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `fromCircuit` ENUM('SALES_TEAM', 'OFFICE_MANAGER') NULL,
    `toCircuit` ENUM('SALES_TEAM', 'OFFICE_MANAGER') NOT NULL,
    `reason` TEXT NOT NULL,
    `authorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_circuit_changes_leadId_createdAt_idx`(`leadId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `member_documents` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `kind` ENUM('CONTRACT', 'DOMICILIATION_CERTIFICATE', 'OFFICIAL_DOCUMENT', 'RECEIPT', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `title` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `member_documents_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `commission_rules` (
    `id` VARCHAR(191) NOT NULL,
    `beneficiary` ENUM('CLOSER', 'OFFICE_MANAGER') NOT NULL,
    `serviceId` VARCHAR(191) NULL,
    `planId` VARCHAR(191) NULL,
    `category` ENUM('DOMICILIATION', 'CREATION_ENTREPRISE', 'ADMINISTRATION', 'COMPTABILITE', 'JURIDIQUE', 'MARKETING', 'SECRETARIAT', 'OFFRE', 'DIASPORA', 'INCUBATION', 'AUTRE') NULL,
    `leadKind` ENUM('NEW_BUSINESS', 'EXTENSION', 'RENEWAL') NULL,
    `circuit` ENUM('SALES_TEAM', 'OFFICE_MANAGER') NULL,
    `mode` ENUM('RATE', 'FIXED') NOT NULL,
    `value` DECIMAL(12, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `commission_rules_beneficiary_isActive_idx`(`beneficiary`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `commissions` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `invoiceLineId` VARCHAR(191) NULL,
    `orderId` VARCHAR(191) NULL,
    `beneficiaryId` VARCHAR(191) NOT NULL,
    `role` ENUM('CLOSER', 'OFFICE_MANAGER') NOT NULL,
    `ruleId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `baseAmount` DECIMAL(12, 2) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDING', 'ELIGIBLE', 'CHECKED', 'VALIDATED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `checkedById` VARCHAR(191) NULL,
    `checkedAt` DATETIME(3) NULL,
    `validatedById` VARCHAR(191) NULL,
    `validatedAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `commissions_beneficiaryId_status_idx`(`beneficiaryId`, `status`),
    INDEX `commissions_status_idx`(`status`),
    UNIQUE INDEX `commissions_invoiceLineId_role_key`(`invoiceLineId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_settings` (
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `invoices_proformaNumber_key` ON `invoices`(`proformaNumber`);

-- CreateIndex
CREATE INDEX `leads_circuit_stage_idx` ON `leads`(`circuit`, `stage`);

-- CreateIndex
CREATE INDEX `leads_salesAgentId_idx` ON `leads`(`salesAgentId`);

-- CreateIndex
CREATE INDEX `leads_email_idx` ON `leads`(`email`);

-- CreateIndex
CREATE INDEX `leads_phone_idx` ON `leads`(`phone`);

-- CreateIndex
CREATE UNIQUE INDEX `service_orders_renewedFromId_key` ON `service_orders`(`renewedFromId`);

-- CreateIndex
CREATE INDEX `service_orders_userId_status_idx` ON `service_orders`(`userId`, `status`);

-- CreateIndex
CREATE INDEX `service_orders_pole_status_idx` ON `service_orders`(`pole`, `status`);

-- CreateIndex
CREATE INDEX `service_orders_expiresAt_idx` ON `service_orders`(`expiresAt`);

-- CreateIndex
CREATE INDEX `users_referentId_idx` ON `users`(`referentId`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_referentId_fkey` FOREIGN KEY (`referentId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_salesAgentId_fkey` FOREIGN KEY (`salesAgentId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_referrerUserId_fkey` FOREIGN KEY (`referrerUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_parentLeadId_fkey` FOREIGN KEY (`parentLeadId`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_circuit_changes` ADD CONSTRAINT `lead_circuit_changes_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_circuit_changes` ADD CONSTRAINT `lead_circuit_changes_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_validatedById_fkey` FOREIGN KEY (`validatedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_renewedFromId_fkey` FOREIGN KEY (`renewedFromId`) REFERENCES `service_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_documents` ADD CONSTRAINT `member_documents_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_documents` ADD CONSTRAINT `member_documents_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `service_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_documents` ADD CONSTRAINT `member_documents_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commission_rules` ADD CONSTRAINT `commission_rules_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `service_catalog_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commission_rules` ADD CONSTRAINT `commission_rules_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `membership_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commissions` ADD CONSTRAINT `commissions_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commissions` ADD CONSTRAINT `commissions_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commissions` ADD CONSTRAINT `commissions_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `service_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commissions` ADD CONSTRAINT `commissions_beneficiaryId_fkey` FOREIGN KEY (`beneficiaryId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RedefineIndex (l'index implicite de la clé étrangère userId est retiré
-- automatiquement par MySQL / MariaDB dès que celui-ci existe).
CREATE INDEX `leads_userId_idx` ON `leads`(`userId`);

-- Reprise des données : pôle de livraison des services du catalogue (modifiable
-- ensuite depuis le catalogue) — création, administratif, comptable, juridique,
-- secrétariat et incubation → pôle Création d'entreprise ; marketing → IN Group
-- (IN COM) ; le reste (domiciliation, offres, diaspora) → Espaces.
UPDATE `service_catalog_items` SET `pole` = 'COMPANY_CREATION' WHERE `category` IN ('CREATION_ENTREPRISE', 'ADMINISTRATION', 'COMPTABILITE', 'JURIDIQUE', 'SECRETARIAT', 'INCUBATION');
UPDATE `service_catalog_items` SET `pole` = 'IN_GROUP', `subsidiary` = 'IN COM' WHERE `category` = 'MARKETING';

-- Services déjà lancés : pôle et montant HT depuis leur ligne de facture,
-- période depuis l'abonnement activé ; un service livré a démarré à sa livraison.
UPDATE `service_orders` o JOIN `invoice_lines` il ON il.`id` = o.`invoiceLineId`
  SET o.`amount` = ROUND(il.`quantity` * il.`unitPrice`, 2);
UPDATE `service_orders` o JOIN `invoice_lines` il ON il.`id` = o.`invoiceLineId` JOIN `service_catalog_items` c ON c.`id` = il.`serviceId`
  SET o.`pole` = c.`pole`, o.`subsidiary` = c.`subsidiary`;
UPDATE `service_orders` o JOIN `subscriptions` s ON s.`id` = o.`subscriptionId`
  SET o.`startsAt` = s.`startDate`, o.`expiresAt` = s.`endDate`;
UPDATE `service_orders` SET `startsAt` = COALESCE(`completedAt`, `updatedAt`) WHERE `status` = 'DONE' AND `startsAt` IS NULL;

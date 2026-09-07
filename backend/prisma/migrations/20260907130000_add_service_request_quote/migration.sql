-- AlterTable : devis + validation d'une demande de service (demande client 07/09/2026)
ALTER TABLE `service_requests`
  ADD COLUMN `quotedAmount` DECIMAL(10, 2) NULL,
  ADD COLUMN `quotedCurrency` VARCHAR(191) NOT NULL DEFAULT 'DZD',
  ADD COLUMN `adminDetails` TEXT NULL,
  ADD COLUMN `confirmedAt` DATETIME(3) NULL;

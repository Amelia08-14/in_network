-- Remises accordées sur les devis et factures : % par ligne, et remise sur le
-- total (en % ou en montant HT). Les documents existants restent sans remise.
-- AlterTable
ALTER TABLE `invoice_lines` ADD COLUMN `discountRate` DECIMAL(5, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `discountType` ENUM('PERCENT', 'AMOUNT') NULL,
    ADD COLUMN `discountValue` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `quote_lines` ADD COLUMN `discountRate` DECIMAL(5, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `quotes` ADD COLUMN `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `discountType` ENUM('PERCENT', 'AMOUNT') NULL,
    ADD COLUMN `discountValue` DECIMAL(12, 2) NOT NULL DEFAULT 0;


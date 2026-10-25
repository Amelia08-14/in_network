-- Page Contact refondue (audit du site, 25/10/2026) : sujet de la demande
-- (liste réglée par le super administrateur) et téléphone facultatif.
ALTER TABLE `contact_messages` ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `subject` VARCHAR(191) NULL;

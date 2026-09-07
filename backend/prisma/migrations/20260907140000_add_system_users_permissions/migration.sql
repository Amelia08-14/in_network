-- Rôle staff restreint + permissions backoffice granulaires (demande client 07/09/2026)
ALTER TABLE `users` MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN', 'OFFICE_MANAGER', 'MEMBER') NOT NULL DEFAULT 'MEMBER';
ALTER TABLE `users` ADD COLUMN `permissions` JSON NULL;
ALTER TABLE `users` ADD COLUMN `displayName` VARCHAR(191) NULL;

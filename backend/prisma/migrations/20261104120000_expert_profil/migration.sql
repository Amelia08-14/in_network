-- Profil complet des experts (demande cliente 04/11/2026) : LinkedIn, ville, langues.
ALTER TABLE `expert_profiles` ADD COLUMN `linkedinUrl` VARCHAR(191) NULL,
    ADD COLUMN `location` VARCHAR(191) NULL,
    ADD COLUMN `languages` VARCHAR(191) NULL;

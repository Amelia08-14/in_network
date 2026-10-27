-- Pièce d'identité exigée pour un profil complet (demande client 27/10/2026).
-- Le fichier reste privé (private-uploads/identity) ; seuls ses métadonnées sont ici.
ALTER TABLE `member_profiles` ADD COLUMN `idDocumentPath` VARCHAR(191) NULL,
    ADD COLUMN `idDocumentName` VARCHAR(191) NULL,
    ADD COLUMN `idDocumentMime` VARCHAR(191) NULL,
    ADD COLUMN `idDocumentUploadedAt` DATETIME(3) NULL;

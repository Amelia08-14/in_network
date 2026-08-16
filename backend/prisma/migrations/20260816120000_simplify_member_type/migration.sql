-- Simplifie les types de compte à Freelance / Startup / Entreprise.
-- PME devient ENTREPRISE ; DIASPORA et AUTRE (catégories retirées) sont
-- rattachés à ENTREPRISE par défaut, faute de catégorie plus proche.
UPDATE `member_profiles` SET `memberType` = 'ENTREPRISE' WHERE `memberType` IN ('PME', 'DIASPORA', 'AUTRE');

-- AlterTable
ALTER TABLE `member_profiles` MODIFY `memberType` ENUM('FREELANCE', 'STARTUP', 'ENTREPRISE') NOT NULL DEFAULT 'FREELANCE';

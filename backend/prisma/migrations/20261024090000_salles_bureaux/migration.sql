-- Salles et bureaux réels d'IN NETWORK Hydra (24/10/2026).
-- Salles de réunion réservées à l'heure (matin / après-midi) ; bureaux privatifs
-- loués au mois, attribués par l'Office Manager sur le service du membre.
-- AlterTable
ALTER TABLE `service_orders` ADD COLUMN `spaceId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `space_resources` ADD COLUMN `capacityMin` INTEGER NULL,
    ADD COLUMN `description` TEXT NULL;

-- AddForeignKey
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_spaceId_fkey` FOREIGN KEY (`spaceId`) REFERENCES `space_resources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Les deux salles génériques deviennent les vraies salles (tarifs conservés :
-- fichier « N°02 - service et tarifs », salle 6 chaises et salle 14 chaises visio).
UPDATE `space_resources` SET `name` = 'Salle Network', `capacityMin` = 6, `capacity` = 8,
  `description` = 'Salle de réunion de 6 à 8 personnes : vidéoprojecteur, tableau blanc, accès internet.'
WHERE `type` = 'MEETING_ROOM' AND `name` = 'Salle de réunion 1';
UPDATE `space_resources` SET `name` = 'Salle LMIG', `capacityMin` = 10, `capacity` = 18,
  `description` = 'Salle de réunion de 10 à 18 personnes, équipée pour la visioconférence : vidéoprojecteur, tableau blanc, accès internet.'
WHERE `type` = 'MEETING_ROOM' AND `name` = 'Salle de réunion 2';

-- Nouveaux espaces (sans tarif : à renseigner dans Admin › Tarifs).
INSERT INTO `space_resources` (`id`, `siteId`, `type`, `name`, `capacity`, `capacityMin`, `description`, `isActive`)
SELECT v.id, s.id, v.type, v.name, v.capacity, v.capacityMin, v.description, 1
FROM (
  SELECT 'spc-salle-conference' AS id, 'MEETING_ROOM' AS type, 'Salle de conférence avec terrasse' AS name, 30 AS capacity, NULL AS capacityMin, 'Salle de conférence jusqu''à 30 personnes, avec terrasse.' AS description
  UNION ALL SELECT 'spc-bureau-delta', 'PRIVATE_OFFICE', 'Bureau Delta', 2, NULL, 'Bureau fermé pour 2 personnes : deux bureaux et un meuble de rangement.'
  UNION ALL SELECT 'spc-bureau-beta', 'PRIVATE_OFFICE', 'Bureau Bêta', 2, NULL, 'Bureau fermé pour 2 personnes : deux bureaux et un meuble de rangement.'
  UNION ALL SELECT 'spc-bureau-gamma', 'PRIVATE_OFFICE', 'Bureau Gamma', 2, NULL, 'Bureau fermé pour 2 personnes : deux bureaux et un meuble de rangement.'
  UNION ALL SELECT 'spc-bureau-y', 'PRIVATE_OFFICE', 'Bureau Y', 4, NULL, 'Bureau fermé pour 4 personnes.'
  UNION ALL SELECT 'spc-bureau-z', 'PRIVATE_OFFICE', 'Bureau Z', 4, NULL, 'Bureau fermé pour 4 personnes.'
) v
JOIN (SELECT `id` FROM `sites` WHERE `isActive` = 1 ORDER BY `createdAt` LIMIT 1) s
WHERE NOT EXISTS (SELECT 1 FROM `space_resources` x WHERE x.`name` = v.name);

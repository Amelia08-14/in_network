-- Témoignages (audit 27/10/2026, tâche 3.19) : légende « prénom · activité ·
-- contexte ». L'activité existe déjà (authorRole) ; on ajoute le contexte
-- (ex. « membre depuis 2025, bureau privé »), saisi avec l'accord de la personne.
ALTER TABLE `testimonials` ADD COLUMN `authorContext` VARCHAR(191) NULL;

INSERT INTO `expert_connection_requests` (
    `id`,
    `requesterUserId`,
    `expertProfileId`,
    `message`,
    `status`,
    `createdAt`
)
SELECT
    UUID(),
    `users`.`id`,
    `expert_profiles`.`id`,
    CASE
        WHEN LOCATE('\n\n', `contact_messages`.`message`) > 0
        THEN SUBSTRING(`contact_messages`.`message`, LOCATE('\n\n', `contact_messages`.`message`) + 2)
        ELSE `contact_messages`.`message`
    END,
    'PENDING',
    `contact_messages`.`createdAt`
FROM `contact_messages`
INNER JOIN `users`
    ON LOWER(`users`.`email`) = LOWER(`contact_messages`.`email`)
INNER JOIN `expert_profiles`
    ON `contact_messages`.`message` LIKE CONCAT(
        'Demande de mise en relation avec l''expert ',
        `expert_profiles`.`displayName`,
        '.%'
    )
WHERE NOT EXISTS (
    SELECT 1
    FROM `expert_connection_requests`
    WHERE `expert_connection_requests`.`requesterUserId` = `users`.`id`
      AND `expert_connection_requests`.`expertProfileId` = `expert_profiles`.`id`
      AND `expert_connection_requests`.`createdAt` = `contact_messages`.`createdAt`
);
